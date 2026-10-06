#!/usr/bin/env node
// Retro-replay of AL-02 (ceiling precheck) and AL-03 (gate v3) on stored data. No model calls, no writes
// except the optional --out JSON. Reads learning/ledger.jsonl, learning/eval/*, learning/runs/*/before.json
// and per-defect data from state/grading (blind GRADING.md tables or re-scored REG reports + KEY).
//   node scripts/replay-gates.mjs [--out=learning/replay-al.json]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGrading, gate, gateV3, ceilingCheck } from './lib/learn.mjs';
import { scoreReport, aggregate } from './lib/grade.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const P = (...a) => join(ROOT, ...a);
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const ledger = readFileSync(P('learning', 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !['KEY_LOCK', 'SKIPPED_CEILING'].includes(r.verdict));
const norm = (p) => String(p).replace(/\\/g, '/');

// ---------- per-defect matrices ----------
/** From a blind-grader GRADING.md: arms (letters, in rep order) -> { id: { gtSev, score[], agree[] } } */
function matrixFromGrading(dir, letters) {
  const g = parseGrading(readFileSync(P(dir, 'GRADING.md'), 'utf8'));
  const m = {};
  for (const d of g.defects) m[d.id] = { gtSev: d.gtSev, score: letters.map((a) => d.per[a].score), agree: letters.map((a) => (d.per[a].score > 0 && d.per[a].sev && d.gtSev ? d.per[a].sev === d.gtSev : null)) };
  return m;
}
const lettersFor = (dir, labels) => { const k = readJson(P(dir, 'BLIND-KEY.json')); return labels.map((l) => Object.keys(k).find((x) => k[x] === l)); };
/** From stored REG reports: re-score with the KEY/DECOYS/LABELS that sit in the grading folder. */
function matrixFromReg(label, cid) {
  const gd = P('state', 'grading', `REG-${label}`, cid);
  if (!existsSync(join(gd, 'KEY.json'))) return null;
  const key = readJson(join(gd, 'KEY.json')), decoys = existsSync(join(gd, 'DECOYS.json')) ? readJson(join(gd, 'DECOYS.json')) : null;
  const labels = existsSync(join(gd, 'LABELS.json')) ? readJson(join(gd, 'LABELS.json')) : null;
  const reps = [1, 2, 3].map((i) => `REPORT-R${i}.md`).filter((n) => existsSync(join(gd, n)))
    .map((n) => scoreReport(readFileSync(join(gd, n), 'utf8'), key, { decoys, labels: labels?.per_report?.[n] ?? labels }));
  return reps.length ? aggregate(reps) : null;
}

/** Ledger row -> [{ case, before, after }] with per_defect where the data exists, plus a note. */
function casesFor(row) {
  const b = norm(row.before), a = norm(row.after);
  const before = readJson(P(b)), after = readJson(P(a));
  const reg = a.match(/REG-(.+)-(cm-\d+)\.json$/);
  if (reg) {
    const bl = b.match(/REG-(.+)-(cm-\d+)\.json$/)[1], cid = reg[2];
    const mb = matrixFromReg(bl, cid), ma = matrixFromReg(reg[1], cid);
    const drift = [[bl, before, mb], [reg[1], after, ma]].filter(([, s, r]) => r && (Math.abs(r.recall_points - s.recall_points) > 0.01 || Math.abs(r.severity_agreement_pct - s.severity_agreement_pct) > 0.1))
      .map(([l, s, r]) => `${l}: stored ${s.recall_points}/${s.severity_agreement_pct}% vs re-scored ${r.recall_points}/${r.severity_agreement_pct}%`);
    return { cases: [{ case: cid, before: { ...before, per_defect: mb?.per_defect }, after: { ...after, per_defect: ma?.per_defect } }], source: 're-scored REG reports + KEY', drift };
  }
  if (/RUN-003-/.test(a)) {
    const dir = 'state/grading/RUN-003';
    return { cases: [{ case: 'RUN-003', before: { ...before, per_defect: matrixFromGrading(dir, lettersFor(dir, ['B1', 'B2'])) }, after: { ...after, per_defect: matrixFromGrading(dir, lettersFor(dir, ['C1', 'C2'])) } }], source: 'blind GRADING.md (B1-C1, B2-C2)', drift: [] };
  }
  const r5 = a.match(/RUN-005-([ABC])\.json$/);
  if (r5) {
    const dir = 'state/grading/RUN-005/landing', bl = b.match(/RUN-005-([ABC])\.json$/)[1];
    const arm = (x) => [1, 2, 3].map((i) => `${x}-${i}`);
    return { cases: [{ case: 'RUN-005/landing', before: { ...before, per_defect: matrixFromGrading(dir, lettersFor(dir, arm(bl))) }, after: { ...after, per_defect: matrixFromGrading(dir, lettersFor(dir, arm(r5[1]))) } }], source: 'blind GRADING.md (rep i - rep i)', drift: [] };
  }
  if (/RUN-007-R7C/.test(a)) {
    const dir = 'state/grading/RUN-007';
    return { cases: [{ case: 'RUN-007', before: { ...before, per_defect: matrixFromGrading(dir, lettersFor(dir, ['R7B1', 'R7B2', 'R7B3'])) }, after: { ...after, per_defect: matrixFromGrading(dir, lettersFor(dir, ['R7C1', 'R7C2', 'R7C3'])) } }], source: 'blind GRADING.md (rep i - rep i)', drift: [] };
  }
  return { cases: [{ case: a.split('/').slice(-2, -1)[0], before, after }], source: 'MISSING: only aggregate before/after.json; no per-rep reports or per-defect table in the package', drift: [] };
}

// ---------- AL-03 replay ----------
const rows = ledger.map((row, i) => {
  const { cases, source, drift } = casesFor(row);
  const v3 = gateV3(cases, { target: row.target, reps: row.reps });
  const v2now = gate(cases[0].before, cases[0].after, { target: row.target, reps: row.reps });
  const st = v3.sign_test ?? {};
  return { row: i + 1, proposal: row.proposal, target: row.target, old: `${row.verdict}${row.provisional ? ' (prov)' : ''}`, v2now: `${v2now.verdict}${v2now.provisional ? ' (prov)' : ''}`, new: v3.verdict, plus: st.plus, minus: st.minus, p: st.p, source, drift, reasons: v3.reasons, cases };
});

// pooled per proposal and target (the >= 2 cases rule can only be met here)
const groups = {};
for (const r of rows) { const pid = String(r.proposal).split('/')[0]; if (r.source.startsWith('MISSING')) continue; (groups[`${pid}|${r.target}`] ??= []).push(...r.cases); }
const pooled = Object.entries(groups).filter(([, cs]) => cs.length >= 2).map(([k, cs]) => { const [pid, target] = k.split('|'); const v = gateV3(cs, { target, reps: 3 }); return { proposal: pid, target, cases: cs.map((c) => c.case), verdict: v.verdict, plus: v.sign_test.plus, minus: v.sign_test.minus, p: v.sign_test.p, up: v.cases_up, down: v.cases_down }; });
// what-if: each multi-case proposal judged on BOTH recall and severity over all its cases
const byProp = {};
for (const r of rows) { const pid = String(r.proposal).split('/')[0]; if (!r.source.startsWith('MISSING')) (byProp[pid] ??= []).push(...r.cases); }
const whatIf = Object.entries(byProp).filter(([, cs]) => cs.length >= 2).flatMap(([pid, cs]) => ['recall', 'severity'].map((t) => { const v = gateV3(cs, { target: t, reps: 3 }); return { proposal: pid, target: t, cases: cs.map((c) => c.case), verdict: v.verdict, plus: v.sign_test.plus, minus: v.sign_test.minus, p: v.sign_test.p }; }));

// ---------- AL-02 replay ----------
const pre = [];
const targetOf = (re) => ledger.find((r) => re.test(norm(r.after)))?.target ?? 'recall';
const verdictOf = (re) => ledger.filter((r) => re.test(norm(r.after))).map((r) => r.verdict).join('/') || '-';
for (const run of ['RUN-013-SEO-SENIOR', 'RUN-014-SEO-SENIOR-V2', 'RUN-015-SEO-FIELD', 'RUN-023-SEO-CLAUDESEO']) {
  const m = readJson(P('learning', 'runs', run, 'before.json')); const re = new RegExp(run);
  const t = targetOf(re); const c = ceilingCheck(m, { target: t });
  pre.push({ baseline: run, target: t, value: c.value, rep1: null, skip: c.ceiling, ledger: verdictOf(re) });
}
for (const [role, cases] of [['cm', ['cm-01', 'cm-02', 'cm-03']], ['corax', ['cm-01', 'cm-02']], ['dorn', ['cm-01', 'cm-03']]]) for (const cid of cases) {
  const m = readJson(P('learning', 'eval', `REG-${role}-base-${cid}.json`)); const re = new RegExp(`REG-${role}-cand-${cid}`);
  const t = targetOf(re); const c1 = ceilingCheck(m, { target: t, rep: 1 }), cm = ceilingCheck(m, { target: t });
  pre.push({ baseline: `${role}-base/${cid}`, target: t, value: cm.value, rep1: t === 'recall' ? c1.value : null, skip: c1.ceiling, ledger: verdictOf(re) });
}

// ---------- output ----------
const f = (x) => (x == null ? '-' : x);
console.log('## AL-02 precheck replay (recall >= 0.95, severity >= 0.90; rep 1 where per-rep data exists)');
console.log('| Baseline | Target | Mean | Rep 1 | Precheck | Ledger verdict |\n|---|---|---|---|---|---|');
for (const r of pre) console.log(`| ${r.baseline} | ${r.target} | ${r.value} | ${f(r.rep1)} | ${r.skip ? '**SKIP**' : 'run'} | ${r.ledger} |`);
console.log('\n## AL-03 v3 replay per ledger row (one case per row, so >= 2 cases cannot be met: PROVISIONAL at best)');
console.log('| # | Proposal | Target | Ledger (as decided) | v2 today | v3 | +/- pairs | p | Data |\n|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.row} | ${r.proposal} | ${r.target} | ${r.old} | ${r.v2now} | ${r.new} | ${r.plus ?? '-'}/${r.minus ?? '-'} | ${f(r.p)} | ${r.source.startsWith('MISSING') ? 'missing' : r.source}${r.drift.length ? ' ⚠' : ''} |`);
console.log('\n## Pooled per proposal (same target, >= 2 cases)');
console.log('| Proposal | Target | Cases | v3 | +/- | p |\n|---|---|---|---|---|---|');
for (const r of pooled) console.log(`| ${r.proposal} | ${r.target} | ${r.cases.join(', ')} | ${r.verdict} | ${r.plus}/${r.minus} | ${r.p} |`);
console.log('\n## What-if: all cases of a proposal on each target');
console.log('| Proposal | Target | Cases | v3 | +/- | p |\n|---|---|---|---|---|---|');
for (const r of whatIf) console.log(`| ${r.proposal} | ${r.target} | ${r.cases.join(', ')} | ${r.verdict} | ${r.plus}/${r.minus} | ${r.p} |`);
const drift = rows.filter((r) => r.drift.length);
if (drift.length) { console.log('\n## Stored vs re-scored drift (key edited after the stored eval was written?)'); for (const r of drift) console.log(`- row ${r.row}: ${r.drift.join('; ')}`); }
for (const r of rows.filter((x) => x.reasons.length)) console.log(`- row ${r.row} reasons: ${r.reasons.join('; ')}`);
if (flags.out) writeFileSync(P(flags.out), JSON.stringify({ precheck: pre, rows: rows.map(({ cases, ...x }) => x), pooled, whatIf }, null, 2));
