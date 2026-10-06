// Scripted blind grading (A8 of proposals/FABLE-ORCH-AUDIT.md, D3 of work/claudemaxing-v1).
// A key (KEY.json) carries one detector per defect: regexes that match a report which found that defect.
// Scoring is deterministic: recall and severity agreement come from detectors; decoys (DECOYS.json) count as
// false claims when a report asserts them as defects; findings no detector matched are "extras" and go to a
// model grader (VALID / NOISE / FALSE) through a labels file. No one grades by hand.
export const GRADER_VERSION = 'scripted:grade.mjs@1';

const SEV_RE = /\b(critical|major|minor)\b/i;
const normSev = (s) => (s ? String(s).toLowerCase() : null);

/** Split a report into finding chunks. Lean: "N. [sev] [cat] …"; full: "[SEVERITY: x] …" lines; headings "### …". */
export function splitFindings(md) {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s*FINDINGS/i.test(l));
  const body = start >= 0 ? lines.slice(start + 1) : lines;
  const chunks = [];
  let cur = null;
  for (const l of body) {
    if (/^##\s/.test(l) && start >= 0) break; // next top-level section (FILES, RISKS…)
    const isHead = /^\s*\d+[.)]\s/.test(l) || /^\s*\[SEVERITY/i.test(l) || /^###\s/.test(l) || /^\s*[-*]\s*\[(critical|major|minor)\]/i.test(l);
    if (isHead) { cur = { text: l, sev: null }; chunks.push(cur); }
    else if (cur) cur.text += '\n' + l;
  }
  for (const c of chunks) {
    const m = c.text.match(/\[SEVERITY:\s*(critical|major|minor)\]/i) || c.text.split('\n')[0].match(SEV_RE);
    c.sev = normSev(m?.[1]);
  }
  return chunks;
}

const compile = (re) => new RegExp(re, 'i');
const anyMatch = (det, text) => (det?.any ?? []).some((re) => { try { return compile(re).test(text); } catch { return false; } });
const NEGATED = /\b(not present|is present|are present|present on|no such|unverified|could not (?:confirm|verify)|cannot (?:confirm|verify|answer)|no evidence|already (?:set|present|correct|has|have)|is correct|are correct|does exist|exists|confirmed (?:present|correct)|not (?:a|an) (?:defect|issue)|asserted .{0,60}not (?:present|found|true)|claim .{0,40}(?:false|incorrect|not borne out))\b/i;

/** Score one report against a key. Returns the eval-json metrics plus details. */
export function scoreReport(md, key, { decoys = null, labels = null, tokens = null } = {}) {
  const findings = splitFindings(md);
  const matched = new Set();
  const hits = [];
  for (const d of key.defects ?? []) {
    const idx = findings.findIndex((f) => anyMatch(d.detector, f.text));
    const found = idx >= 0 || anyMatch(d.detector, md); // fall back to whole text (report without numbered findings)
    const sev = idx >= 0 ? findings[idx].sev : null;
    if (idx >= 0) matched.add(idx);
    hits.push({ id: d.id, found, gtSev: normSev(d.severity), sev, agree: found && sev ? sev === normSev(d.severity) : null });
  }
  const falseClaims = [];
  for (const dc of decoys?.decoys ?? decoys?.items ?? []) {
    const det = dc.detector ?? dc.detector_false;
    const idx = findings.findIndex((f) => anyMatch(det, f.text) && !NEGATED.test(f.text));
    if (idx >= 0) { falseClaims.push({ id: dc.id, finding: findings[idx].text.split('\n')[0].slice(0, 160) }); matched.add(idx); }
  }
  const extras = findings.map((f, i) => ({ i, head: f.text.split('\n')[0].slice(0, 200), sev: f.sev })).filter((e) => !matched.has(e.i));
  const lab = labels?.labels ?? labels ?? {};
  let valid = 0, noise = 0, falseL = 0, unlabelled = 0;
  for (const e of extras) {
    const c = String(lab[String(e.i)] ?? lab[e.head] ?? '').toUpperCase();
    if (c === 'VALID') valid++; else if (c === 'NOISE') noise++; else if (c === 'FALSE') falseL++; else unlabelled++;
  }
  const foundN = hits.filter((h) => h.found).length;
  const agreeN = hits.filter((h) => h.agree === true).length, agreeDen = hits.filter((h) => h.agree !== null).length;
  const critGiven = findings.filter((f) => f.sev === 'critical').length;
  const critCorrect = hits.filter((h) => h.found && h.gtSev === 'critical' && h.sev === 'critical').length;
  return {
    grading: GRADER_VERSION,
    recall_points: foundN, max_points: (key.defects ?? []).length,
    severity_agreement_pct: agreeDen ? +((agreeN / agreeDen) * 100).toFixed(1) : 0,
    extras_valid: valid, extras_noise: noise, extras_false: falseL + falseClaims.length,
    extras_unlabelled: unlabelled, decoy_false_claims: falseClaims.length,
    criticals_given: critGiven, criticals_correct: critCorrect,
    tokens: tokens ?? undefined,
    detail: { hits, false_claims: falseClaims, extras },
  };
}

/**
 * Per-defect x rep matrix (gate v3, AL-03): { <defect id>: { gtSev, found: [bool per rep], agree: [true|false|null per rep] } }.
 * found = the rep's report detected the defect; agree = its severity matched the key (null when not found or unrated).
 * Reps keep their input order, so before/after matrices pair by rep index.
 */
export function perDefectMatrix(reps) {
  const m = {};
  reps.forEach((r, i) => {
    for (const h of r.detail?.hits ?? []) {
      const row = (m[h.id] ??= { gtSev: h.gtSev ?? null, found: [], agree: [] });
      row.found[i] = !!h.found; row.agree[i] = h.agree ?? null;
    }
  });
  for (const row of Object.values(m)) for (let i = 0; i < reps.length; i++) { row.found[i] ??= false; row.agree[i] ??= null; }
  return m;
}

/** Mean of several reps (same key) in the eval-json shape, with per_rep recall for the paired gate check. */
export function aggregate(reps) {
  const n = reps.length; if (!n) throw new Error('no reps');
  const mean = (k) => +(reps.reduce((s, r) => s + (r[k] ?? 0), 0) / n).toFixed(2);
  const out = {
    grading: GRADER_VERSION, reps: n,
    recall_points: mean('recall_points'), max_points: reps[0].max_points,
    severity_agreement_pct: mean('severity_agreement_pct'),
    extras_valid: mean('extras_valid'), extras_noise: mean('extras_noise'), extras_false: mean('extras_false'),
    extras_unlabelled: mean('extras_unlabelled'), decoy_false_claims: mean('decoy_false_claims'),
    criticals_given: mean('criticals_given'), criticals_correct: mean('criticals_correct'),
    per_rep: reps.map((r) => r.recall_points),
  };
  if (reps.every((r) => Array.isArray(r.detail?.hits))) out.per_defect = perDefectMatrix(reps);
  if (reps.every((r) => Number.isFinite(r.tokens))) out.tokens = mean('tokens');
  return out;
}

/** Author-side check: every detector compiles and, when the key carries an `example` sentence, matches it. */
export function lintKey(key, decoys = null) {
  const problems = [];
  for (const d of key.defects ?? []) {
    if (!d.detector?.any?.length) { problems.push(`${d.id}: no detector`); continue; }
    for (const re of d.detector.any) { try { compile(re); } catch (e) { problems.push(`${d.id}: bad regex ${re}: ${e.message}`); } }
    if (d.detector.example && !anyMatch(d.detector, d.detector.example)) problems.push(`${d.id}: detector does not match its own example`);
    for (const dc of decoys?.decoys ?? []) {
      const s = dc.statement ?? dc.claim;
      if (s && anyMatch(d.detector, s)) problems.push(`${d.id}: detector matches decoy ${dc.id}`);
      if (d.detector.example && anyMatch(dc.detector, d.detector.example)) problems.push(`decoy ${dc.id}: detector matches the example of real defect ${d.id}`);
    }
  }
  return problems;
}
