// CAWL learning loop, deterministic half (no model calls):
//   1) parseGrading: read a blind-grader report (GRADING.md) into per-defect, per-arm scores + extras
//   2) buildSignals: turn graded runs + telemetry into learning signals (what agents miss, mis-rate, over-report)
//   3) gate: decide whether a proposed agent change is ACCEPTED, from before/after grading of a held-out case
// The model half (CAWL agent) reads signals.json and writes proposals; it never grades its own proposals.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const SEV = { crit: 'critical', critical: 'critical', maj: 'major', major: 'major', min: 'minor', minor: 'minor' };
const RANK = { minor: 1, major: 2, critical: 3 };
const normSev = (s) => SEV[String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')] ?? null;
const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

/** Parse a GRADING.md. Handles both layouts used so far:
 *  RUN-001: | ID | GT sev | A | A sev | B | B sev | ... |   (sev cell like "crit вњ“")
 *  RUN-002: | ID | GT sev | P | Q | ... |                   (cell like "1 (major)") */
export function parseGrading(md) {
  const lines = md.split(/\r?\n/);
  const hi = lines.findIndex((l) => /^\|\s*ID\s*\|/.test(l));
  if (hi < 0) throw new Error('per-defect table not found (expected a row starting with "| ID |")');
  const head = cells(lines[hi]);
  const arms = head.filter((h) => /^[A-Z]$/.test(h));
  const col = (name) => head.indexOf(name);
  const defects = [];
  for (let i = hi + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const c = cells(lines[i]);
    const m = c[0].match(/^([A-Z]\d{2})\s*(.*)$/); if (!m) continue; // skips **Sum** / **Recall** rows
    const d = { id: m[1], title: m[2], gtSev: normSev(c[col('GT sev')]), per: {} };
    for (const a of arms) {
      const v = c[col(a)] ?? '';
      const score = Number((v.match(/^[\d.]+/) ?? [NaN])[0]);
      const sevInline = v.match(/\(([a-z]+)\)/i)?.[1];
      const sevCol = col(`${a} sev`) >= 0 ? c[col(`${a} sev`)].split(/\s/)[0] : null;
      d.per[a] = { score: Number.isFinite(score) ? score : 0, sev: normSev(sevInline ?? sevCol) };
    }
    defects.push(d);
  }
  // extras: "### P" or "### Report A" followed by a table with a Class column
  const extras = Object.fromEntries(arms.map((a) => [a, []]));
  let arm = null;
  for (const l of lines) {
    const h = l.match(/^###\s+(?:Report\s+)?([A-Z])\b/); if (h) { arm = arms.includes(h[1]) ? h[1] : null; continue; }
    if (/^##\s/.test(l)) arm = null;
    if (!arm || !l.startsWith('|')) continue;
    const c = cells(l); const k = c.findIndex((x) => /^(VALID|NOISE|FALSE)(\s*[x×]\s*\d+)?$/.test(x)); if (k < 0) continue;
    const [, cls, times] = c[k].match(/^(VALID|NOISE|FALSE)(?:\s*[x×]\s*(\d+))?$/); // grader groups duplicates as "NOISE x16"
    for (let j = 0; j < Number(times ?? 1); j++) extras[arm].push({ item: c[0], class: cls, note: c[k + 1] ?? '', grouped: Number(times ?? 1) });
  }
  return { arms, defects, extras };
}

const CATEGORY_OWNER = { seo: 'corax', design: 'sanguinius', a11y: 'dorn', qa: 'dorn', commercial: 'khan', content: 'khan' };

/** Build learning signals from graded runs. runs: [{ run, grading, groundTruth, arms: {X: {system, kind, agents}} }] */
export function buildSignals(runs, telemetry = []) {
  const signals = []; let n = 0; const S = (o) => signals.push({ id: `SIG-${String(++n).padStart(3, '0')}`, ...o });
  for (const r of runs) {
    const gt = Object.fromEntries((r.groundTruth.defects ?? []).map((d) => [d.id, d]));
    const armInfo = (a) => r.arms[a] ?? { system: 'unknown', kind: 'unknown', agents: [] };
    for (const d of r.grading.defects) {
      const cat = gt[d.id]?.category ?? null; const owner = CATEGORY_OWNER[cat] ?? null;
      // misses and partials
      for (const a of r.grading.arms) {
        const p = d.per[a]; if (p.score >= 1) continue;
        S({ type: p.score === 0 ? 'miss' : 'partial', run: r.run, arm: a, system: armInfo(a).system, kind: armInfo(a).kind, defect: d.id, title: gt[d.id]?.title ?? d.title, category: cat, owner, gtSev: d.gtSev, score: p.score });
      }
      // systemic severity mis-rating: most arms that detected it rate it the same wrong way
      const rated = r.grading.arms.map((a) => d.per[a]).filter((p) => p.score > 0 && p.sev && d.gtSev);
      const over = rated.filter((p) => RANK[p.sev] > RANK[d.gtSev]).length, under = rated.filter((p) => RANK[p.sev] < RANK[d.gtSev]).length;
      const dir = over >= Math.ceil(rated.length * 0.75) ? 'over' : under >= Math.ceil(rated.length * 0.75) ? 'under' : null;
      if (rated.length >= 2 && dir) S({ type: 'severity', run: r.run, defect: d.id, title: gt[d.id]?.title ?? d.title, category: cat, owner, gtSev: d.gtSev, direction: dir, arms: rated.length, given: [...new Set(rated.map((p) => p.sev))] });
      // synthesis loss: a raw specialist arm had it, the same system's final report did not
      for (const a of r.grading.arms) {
        if (armInfo(a).kind !== 'final') continue;
        const raw = r.grading.arms.find((b) => armInfo(b).kind === 'raw' && armInfo(b).system === armInfo(a).system);
        if (raw && d.per[raw].score > d.per[a].score) S({ type: 'synthesis-loss', run: r.run, system: armInfo(a).system, final: a, raw, defect: d.id, title: gt[d.id]?.title ?? d.title, lost: d.per[raw].score - d.per[a].score });
      }
    }
    // noise: true-but-trivial or duplicate extras
    for (const a of r.grading.arms) {
      const ex = r.grading.extras[a] ?? []; const noise = ex.filter((e) => e.class === 'NOISE'), fals = ex.filter((e) => e.class === 'FALSE');
      if (ex.length) S({ type: 'noise', run: r.run, arm: a, system: armInfo(a).system, kind: armInfo(a).kind, valid: ex.filter((e) => e.class === 'VALID').length, noise: noise.length, false: fals.length, ratio: +(noise.length / ex.length).toFixed(2), examples: [...new Set(noise.map((e) => `${e.item}${e.note ? ` (${e.note})` : ''}${e.grouped > 1 ? ` ×${e.grouped}` : ''}`))].slice(0, 8) });
      for (const f of fals) S({ type: 'false-claim', run: r.run, arm: a, system: armInfo(a).system, item: f.item, note: f.note });
    }
  }
  // efficiency: tokens per specialist task
  const byAgent = {};
  for (const t of telemetry) if (t.total_tokens && t.agent && !/direct|grader/i.test(t.agent)) (byAgent[t.agent] ??= []).push({ task: t.task_id, run: t.run_id, tokens: t.total_tokens, packet: t.context_packet_chars });
  for (const [agent, rows] of Object.entries(byAgent)) S({ type: 'cost', agent, tasks: rows.length, tokensMedian: median(rows.map((x) => x.tokens)), rows });
  return signals;
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

export function summarizeSignals(signals) {
  const by = (t) => signals.filter((s) => s.type === t);
  const owners = {}; for (const s of [...by('miss'), ...by('partial'), ...by('severity')]) if (s.owner) owners[s.owner] = (owners[s.owner] ?? 0) + 1;
  return { total: signals.length, miss: by('miss').length, partial: by('partial').length, severity: by('severity').length, synthesisLoss: by('synthesis-loss').length, noiseArms: by('noise').length, falseClaims: by('false-claim').length, cost: by('cost').length, byOwner: owners };
}

/**
 * Load graded runs from state/grading/<RUN>/ and one level of sub-cases (<RUN>/<case>/), e.g. RUN-005/seo.
 * Needs GRADING.md + GROUND-TRUTH.json. Arms come from ARMS.json, else BLIND-KEY.json ({letter: label}),
 * else every graded arm is "unknown" — a run is never dropped just because its unblinding file is missing.
 */
export function armsFor(dir) {
  if (existsSync(join(dir, 'ARMS.json'))) return JSON.parse(readFileSync(join(dir, 'ARMS.json'), 'utf8')).arms;
  if (existsSync(join(dir, 'BLIND-KEY.json'))) {
    const key = JSON.parse(readFileSync(join(dir, 'BLIND-KEY.json'), 'utf8'));
    return Object.fromEntries(Object.entries(key).filter(([k]) => /^[A-Z]$/.test(k)).map(([letter, label]) => [letter, { system: String(label), kind: 'final', agents: [] }]));
  }
  return {};
}
export function loadRuns(root) {
  const dir = join(root, 'state', 'grading'); if (!existsSync(dir)) return [];
  const graded = (p) => existsSync(join(p, 'GRADING.md')) && existsSync(join(p, 'GROUND-TRUTH.json'));
  const cases = [];
  for (const r of readdirSync(dir)) {
    const p = join(dir, r); if (!statSync(p).isDirectory()) continue;
    if (graded(p)) cases.push([r, p]);
    else for (const c of readdirSync(p)) { const q = join(p, c); if (statSync(q).isDirectory() && graded(q)) cases.push([`${r}/${c}`, q]); }
  }
  return cases.map(([run, p]) => ({
    run, grading: parseGrading(readFileSync(join(p, 'GRADING.md'), 'utf8')),
    groundTruth: JSON.parse(readFileSync(join(p, 'GROUND-TRUTH.json'), 'utf8')), arms: armsFor(p),
  }));
}

/**
 * Promotion gate for one proposal, from a before/after pair graded blind on a HELD-OUT case.
 * before/after: { recall_points, max_points, severity_agreement_pct, extras_valid, extras_noise, extras_false, tokens? }
 * target: the metric the proposal promised to improve. Rules (all must hold for ACCEPT):
 *   - recall never drops; false claims never rise
 *   - the target metric improves by at least minGain
 *   - noise does not rise unless the target is recall
 * n < 3 repetitions => verdict is PROVISIONAL (not enough to be sure).
 */
// Gate v2 (A7 of proposals/FABLE-ORCH-AUDIT.md): false claims as a ratio with tolerance instead of an absolute
// count (one stray claim in 3 reps no longer vetoes a real recall gain), cost per verified finding as a target and
// a veto, and an optional per-rep sign check (paired reps) that keeps a verdict provisional when reps disagree.
export const falseRatio = (m) => { const d = (m.recall_points ?? 0) + (m.extras_valid ?? 0) + (m.extras_false ?? 0); return d ? (m.extras_false ?? 0) / d : 0; };
export const costPerFinding = (m) => { const f = (m.recall_points ?? 0) + (m.extras_valid ?? 0); return m.tokens && f ? m.tokens / f : null; };

/** Who graded an eval file: 'scripted' | 'blind' (model grader that never saw arm identity) | 'hand' | 'unknown'. */
export function gradingProvenance(m) {
  const g = String(m?.grading ?? '').trim();
  if (!g) return 'unknown';
  if (/^scripted\b/i.test(g)) return 'scripted';
  if (/^blind\b/i.test(g)) return 'blind';
  return 'hand';
}

export function gate(before, after, { target, minGain = {}, reps = 1, falseTolerance = 0.02, falseCeiling = 0.1, maxCostRise = 0.3 } = {}) {
  const noiseRatio = (m) => (m.extras_valid + m.extras_noise + m.extras_false ? m.extras_noise / (m.extras_valid + m.extras_noise + m.extras_false) : 0);
  const costGain = (b, a) => { const cb = costPerFinding(b), ca = costPerFinding(a); return cb && ca ? (cb - ca) / cb : 0; };
  const metric = {
    recall: (m) => m.recall_points / (m.max_points ?? 1), severity: (m) => m.severity_agreement_pct / 100, noise: (m) => -noiseRatio(m),
    tokens: (m) => -(m.tokens ?? 0), false_claims: (m) => -falseRatio(m),
  };
  const need = { recall: 0.02, severity: 0.05, noise: 0.05, tokens: 5000, false_claims: 0.02, cost: 0.15, ...minGain };
  if (!metric[target] && target !== 'cost') throw new Error(`unknown target ${target}; use recall|severity|noise|tokens|false_claims|cost`);
  const d = Object.fromEntries(Object.entries(metric).map(([k, f]) => [k, +(f(after) - f(before)).toFixed(4)]));
  d.cost = +costGain(before, after).toFixed(4); // + = cheaper per verified finding
  const reasons = [];
  if (d.recall < 0) reasons.push(`recall dropped (${d.recall})`);
  const fb = falseRatio(before), fa = falseRatio(after);
  if (fa > fb + falseTolerance) reasons.push(`false-claim ratio rose ${fb.toFixed(3)} → ${fa.toFixed(3)} (tolerance ${falseTolerance})`);
  if (fa > falseCeiling) reasons.push(`false-claim ratio ${fa.toFixed(3)} above ceiling ${falseCeiling}`);
  if (d[target] < need[target]) reasons.push(`target "${target}" gain ${d[target]} < required ${need[target]}`);
  if (target !== 'recall' && d.noise < -0.05) reasons.push(`noise ratio rose by ${-d.noise}`);
  if (target !== 'cost' && d.cost < -maxCostRise) reasons.push(`cost per verified finding rose ${Math.round(-d.cost * 100)} % (limit ${Math.round(maxCostRise * 100)} %)`);
  // paired reps: per_rep arrays of the target's raw value (same order in before/after) must all move the same way
  let pairedAgree = null;
  if (Array.isArray(before.per_rep) && Array.isArray(after.per_rep) && before.per_rep.length === after.per_rep.length) {
    const signs = after.per_rep.map((v, i) => Math.sign(v - before.per_rep[i]));
    pairedAgree = signs.every((s) => s > 0) || signs.every((s) => s < 0) || signs.every((s) => s === 0);
  }
  const verdict = reasons.length ? 'REJECT' : 'ACCEPT';
  return { verdict, provisional: reps < 3 || pairedAgree === false, reps, target, delta: d, false_ratio: { before: +fb.toFixed(4), after: +fa.toFixed(4) }, paired_agree: pairedAgree, reasons };
}

// ---------------------------------------------------------------------------------------------------------------
// Gate v3 (AL-03, agent-lab): paired per-defect statistics instead of absolute mean deltas.
// The v2 thresholds (recall +0.02, severity +0.05) are smaller than the score step of a single defect, so a v2
// ACCEPT can rest on one defect flipping in one rep. v3 pairs rep i of the baseline with rep i of the candidate,
// per defect, counts the discordant pairs and runs an exact two-sided sign test pooled over cases.
// ACCEPT (recall|severity) needs p <= alpha AND a positive net on >= minCases cases with no negative case.
// Anything weaker but positive is PROVISIONAL; no gain or a v2 veto is REJECT. Other targets keep v2 logic per case.
// ---------------------------------------------------------------------------------------------------------------
/** Binomial coefficient as a float (exact for the n used here, n <= ~1000). */
function choose(n, k) { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c; }

/** Exact two-sided sign test: k successes out of n discordant pairs under p = 0.5. */
export function signTest(k, n) {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || n < 0 || k > n) throw new Error(`signTest: bad k=${k} n=${n}`);
  if (n === 0) return 1;
  const lo = Math.min(k, n - k);
  let tail = 0; for (let i = 0; i <= lo; i++) tail += choose(n, i);
  return Math.min(1, (2 * tail) / 2 ** n);
}

/**
 * Discordant pairs between two per-defect matrices (see grade.mjs perDefectMatrix / matrixFromScores).
 * recall:   a pair (defect, rep i) is discordant when exactly one arm found the defect; credit is the score
 *           difference sign (scores may be 0 / 0.5 / 1 from a blind grader table).
 * severity: only pairs where both arms found and rated the defect count; discordant when exactly one agrees with the key.
 * Reps pair by index; extra reps on one side are ignored and reported as `unpaired`.
 */
export function discordantPairs(beforeM, afterM, target) {
  const out = { plus: 0, minus: 0, ties: 0, pairs: 0, unpaired: 0, defects_missing: [] };
  for (const [id, b] of Object.entries(beforeM ?? {})) {
    const a = afterM?.[id]; if (!a) { out.defects_missing.push(id); continue; }
    const nb = (b.found ?? b.score ?? []).length, na = (a.found ?? a.score ?? []).length, n = Math.min(nb, na);
    out.unpaired += Math.abs(nb - na);
    for (let i = 0; i < n; i++) {
      let s = 0;
      if (target === 'recall') {
        const vb = b.score ? b.score[i] : (b.found[i] ? 1 : 0), va = a.score ? a.score[i] : (a.found[i] ? 1 : 0);
        s = Math.sign(va - vb);
      } else if (target === 'severity') {
        const gb = b.agree?.[i], ga = a.agree?.[i];
        if (gb == null || ga == null) continue; // not rated in both arms: no severity pair
        s = Math.sign((ga ? 1 : 0) - (gb ? 1 : 0));
      } else throw new Error(`discordantPairs: target ${target} has no per-defect pairs`);
      out.pairs++;
      if (s > 0) out.plus++; else if (s < 0) out.minus++; else out.ties++;
    }
  }
  return out;
}

/** sha256 of a file's bytes (KEY.json / DECOYS.json), or null when the file is absent. */
export function fileSha256(path) { return existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null; }

/**
 * Key lock check: the eval file's key hashes must equal the first `KEY_LOCK` ledger row for its label + case
 * (written by `regress prepare` before the first rep). Returns [] when fine, else reasons.
 */
export function checkKeyLock(evalDoc, ledgerRows) {
  const label = evalDoc?.label, cid = evalDoc?.case;
  if (!label || !cid) return ['eval file has no label/case, so its key lock cannot be checked'];
  const lock = ledgerRows.find((r) => r.verdict === 'KEY_LOCK' && r.label === label && r.case === cid);
  if (!lock) return [`no KEY_LOCK ledger row for ${label}/${cid} (key was not locked before the first rep)`];
  const reasons = [];
  if (!evalDoc.key_sha256) reasons.push(`${label}/${cid}: eval file carries no key_sha256`);
  else if (evalDoc.key_sha256 !== lock.key_sha256) reasons.push(`${label}/${cid}: KEY.json changed after lock (${lock.key_sha256.slice(0, 12)} → ${evalDoc.key_sha256.slice(0, 12)})`);
  if ((evalDoc.decoys_sha256 ?? null) !== (lock.decoys_sha256 ?? null)) reasons.push(`${label}/${cid}: DECOYS.json changed after lock`);
  return reasons;
}

/**
 * Gate v3. cases: [{ case, before, after }] with eval docs that carry `per_defect` (grade.mjs aggregate).
 * Returns the v2-compatible shape plus { gate: 'v3', verdict: ACCEPT|PROVISIONAL|REJECT, sign_test, per_case }.
 */
export function gateV3(cases, { target, reps = 1, alpha = 0.05, minCases = 2, ...v2opts } = {}) {
  if (!Array.isArray(cases) || !cases.length) throw new Error('gateV3: no cases');
  const perCase = cases.map((c) => ({ case: c.case ?? c.after?.case ?? null, v2: gate(c.before, c.after, { target, reps, ...v2opts }) }));
  const paired = target === 'recall' || target === 'severity';
  if (!paired) {
    // token / noise / false_claims / cost: v2 logic per case, all cases must pass
    const rej = perCase.filter((p) => p.v2.verdict === 'REJECT');
    const verdict = rej.length ? 'REJECT' : perCase.some((p) => p.v2.provisional) ? 'PROVISIONAL' : 'ACCEPT';
    return { gate: 'v3', verdict, provisional: verdict === 'PROVISIONAL', reps, target, per_case: perCase.map((p) => ({ case: p.case, verdict: p.v2.verdict, provisional: p.v2.provisional, delta: p.v2.delta, reasons: p.v2.reasons })), reasons: rej.flatMap((p) => p.v2.reasons.map((r) => `${p.case}: ${r}`)) };
  }
  // v2 vetoes still apply per case (recall drop, false claims, noise, cost); the v2 threshold on the target does not
  const targetRe = new RegExp(`^target "${target}" gain`);
  const vetoes = perCase.flatMap((p) => p.v2.reasons.filter((r) => !targetRe.test(r)).map((r) => `${p.case}: ${r}`));
  let plus = 0, minus = 0, pairs = 0; const missing = [];
  const caseRows = cases.map((c, i) => {
    const bm = c.before?.per_defect, am = c.after?.per_defect;
    if (!bm || !am) { missing.push(perCase[i].case); return { case: perCase[i].case, data: 'missing' }; }
    const dp = discordantPairs(bm, am, target);
    plus += dp.plus; minus += dp.minus; pairs += dp.pairs;
    return { case: perCase[i].case, ...dp, net: Math.sign(dp.plus - dp.minus) };
  });
  const n = plus + minus, p = signTest(Math.max(plus, minus), n);
  const up = caseRows.filter((r) => r.net > 0).length, down = caseRows.filter((r) => r.net < 0).length;
  const reasons = [...vetoes];
  if (missing.length) reasons.push(`no per-defect data for ${missing.join(', ')}`);
  let verdict;
  if (vetoes.length) verdict = 'REJECT';
  else if (missing.length === cases.length) {
    // nothing to pair: v3 cannot confirm a gain, so a v2 pass is PROVISIONAL at best
    const v2ok = perCase.every((x) => x.v2.verdict === 'ACCEPT');
    verdict = v2ok ? 'PROVISIONAL' : 'REJECT';
    if (!v2ok) reasons.push(...perCase.flatMap((x) => x.v2.reasons.map((r) => `${x.case}: ${r}`)));
  } else if (plus <= minus) { verdict = 'REJECT'; reasons.push(`no paired gain on "${target}" (${plus} better vs ${minus} worse discordant pairs)`); }
  else if (p <= alpha && up >= minCases && down === 0 && !missing.length) verdict = 'ACCEPT';
  else {
    verdict = 'PROVISIONAL';
    if (p > alpha) reasons.push(`sign test p=${p.toFixed(3)} > ${alpha} (${plus} of ${n} discordant pairs better)`);
    if (up < minCases) reasons.push(`positive on ${up} case(s), ${minCases} required`);
    if (down) reasons.push(`negative on ${down} case(s)`);
  }
  return { gate: 'v3', verdict, provisional: verdict === 'PROVISIONAL', reps, target, sign_test: { plus, minus, discordant: n, pairs, p: +p.toFixed(4), alpha }, per_case: caseRows, cases_up: up, cases_down: down, reasons };
}

/**
 * AL-02 ceiling precheck on a graded baseline eval doc. recall: recall_points/max_points >= threshold (default 0.95);
 * severity: severity_agreement_pct/100 >= threshold (default 0.9). rep = 1-based rep to judge (default: the mean).
 */
export function ceilingCheck(m, { target, threshold, rep = null } = {}) {
  if (target !== 'recall' && target !== 'severity') throw new Error(`precheck target must be recall|severity, got ${target}`);
  const thr = Number(threshold ?? (target === 'recall' ? 0.95 : 0.9));
  let value;
  if (target === 'recall') {
    const pts = rep && Array.isArray(m.per_rep) ? m.per_rep[rep - 1] : m.recall_points;
    value = m.max_points ? pts / m.max_points : 0;
  } else value = (m.severity_agreement_pct ?? 0) / 100;
  return { target, threshold: thr, value: +value.toFixed(4), ceiling: value >= thr };
}
