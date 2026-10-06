#!/usr/bin/env node
// CAWL learning loop CLI.
//   node scripts/learn.mjs signals                    -> learning/signals.json (+ summary)
//   node scripts/learn.mjs gate --before=a.json --after=b.json --target=severity|recall|noise|tokens [--reps=N] [--proposal=ID]
//   node scripts/learn.mjs gate --gate=v3 --before=a1.json,a2.json --after=b1.json,b2.json --target=… [--alpha=0.05] [--min-cases=2]
//        [--allow-unlocked]   -> paired per-defect sign test pooled over cases (AL-03); files pair by position
//   node scripts/learn.mjs ledger                     -> list decisions (learning/ledger.jsonl)
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRuns, buildSignals, summarizeSignals, gate, gateV3, checkKeyLock, gradingProvenance } from './lib/learn.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'learning'); mkdirSync(OUT, { recursive: true });
const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return [a.slice(2, i < 0 ? undefined : i), i < 0 ? true : a.slice(i + 1)]; }));
const readJsonl = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

if (cmd === 'signals') {
  const runs = loadRuns(ROOT);
  const signals = buildSignals(runs, readJsonl(join(ROOT, 'logs', 'telemetry.jsonl')));
  const doc = { generated: new Date().toISOString(), runs: runs.map((r) => ({ run: r.run, arms: r.arms, defects: r.grading.defects.length })), summary: summarizeSignals(signals), signals };
  writeFileSync(join(OUT, 'signals.json'), JSON.stringify(doc, null, 2));
  console.log(JSON.stringify({ file: 'learning/signals.json', runs: doc.runs.map((r) => r.run), ...doc.summary }, null, 2));
} else if (cmd === 'gate') {
  if (!flags.before || !flags.after || !flags.target) { console.error('usage: gate --before=a.json --after=b.json --target=severity|recall|noise|tokens [--reps=N] [--proposal=ID]'); process.exit(2); }
  if (flags.gate === 'v3') gateV3Cli();
  if (flags.gate && flags.gate !== 'v2') { console.error(`unknown --gate=${flags.gate}; use v2 (default) or v3`); process.exit(2); }
  const before = JSON.parse(readFileSync(flags.before, 'utf8')), after = JSON.parse(readFileSync(flags.after, 'utf8'));
  // A8: the gate accepts only scripted or blind-model grading; hand grading by the orchestrator is refused.
  for (const [name, m] of [['before', before], ['after', after]]) {
    const prov = gradingProvenance(m);
    if (prov === 'hand') { console.error(`refused: ${name} file was graded by hand ("${m.grading}"); use scripts/grade.mjs or a blind grader (grading: "blind:<grader_version>")`); process.exit(2); }
    if (prov === 'unknown') console.error(`warning: ${name} file has no "grading" provenance field`);
  }
  const res = gate(before, after, { target: flags.target, reps: Number(flags.reps ?? 1) });
  const row = { at: new Date().toISOString(), proposal: flags.proposal ?? null, before: flags.before, after: flags.after, ...res };
  appendFileSync(join(OUT, 'ledger.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row, null, 2));
  process.exit(res.verdict === 'ACCEPT' ? 0 : 1);
} else if (cmd === 'ledger') {
  for (const r of readJsonl(join(OUT, 'ledger.jsonl'))) console.log(`${r.at}  ${r.proposal ?? r.label ?? '-'}${r.case ? `/${r.case}` : ''}  ${r.gate ?? 'v2'}  ${r.verdict}${r.provisional ? ' (provisional)' : ''}  target=${r.target ?? '-'}  ${r.sign_test ? `p=${r.sign_test.p} (${r.sign_test.plus}+/${r.sign_test.minus}-)` : `Δ=${JSON.stringify(r.delta ?? null)}`}  ${(r.reasons ?? []).join('; ')}`);
} else {
  console.error('usage: learn.mjs signals | gate --before --after --target | ledger'); process.exit(2);
}

// Gate v3 (AL-03). Never the default: NEXUS switches only after the Owner decides.
function gateV3Cli() {
  const list = (v) => String(v).split(',').map((x) => x.trim()).filter(Boolean);
  const bs = list(flags.before), as = list(flags.after);
  if (bs.length !== as.length) { console.error(`v3: ${bs.length} --before file(s) but ${as.length} --after file(s); they pair by position`); process.exit(2); }
  const ledger = readJsonl(join(OUT, 'ledger.jsonl'));
  const refuse = [];
  const cases = bs.map((b, i) => {
    const before = JSON.parse(readFileSync(b, 'utf8')), after = JSON.parse(readFileSync(as[i], 'utf8'));
    for (const [name, m] of [[b, before], [as[i], after]]) {
      const prov = gradingProvenance(m);
      if (prov === 'hand') refuse.push(`${name} was graded by hand ("${m.grading}")`);
      if (!flags['allow-unlocked']) refuse.push(...checkKeyLock(m, ledger));
    }
    if (before.key_sha256 && after.key_sha256 && before.key_sha256 !== after.key_sha256) refuse.push(`${b} and ${as[i]} were graded with different keys`);
    return { case: after.case ?? before.case ?? as[i], before, after };
  });
  if (refuse.length) { console.error(`refused (gate v3):\n  ${refuse.join('\n  ')}`); process.exit(2); }
  const res = gateV3(cases, { target: flags.target, reps: Number(flags.reps ?? 1), alpha: Number(flags.alpha ?? 0.05), minCases: Number(flags['min-cases'] ?? 2) });
  const row = { at: new Date().toISOString(), proposal: flags.proposal ?? null, before: bs, after: as, key_lock: flags['allow-unlocked'] ? 'unchecked' : 'ok', ...res };
  appendFileSync(join(OUT, 'ledger.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row, null, 2));
  process.exit(res.verdict === 'ACCEPT' ? 0 : 1);
}
