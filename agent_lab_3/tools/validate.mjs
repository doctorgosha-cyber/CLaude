// Author-side validation of the four new cases with the package's own grader (scripts/lib/grade.mjs).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const [,, PKG, FIX] = process.argv;
const { lintKey, scoreReport } = await import(join(PKG, 'scripts/lib/grade.mjs'));
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const HINT = /\b(bug|defect|todo|fixme|intentionally|planted|seeded|decoy|regression hunt)\b/i;
let problems = 0;
for (const c of readdirSync(FIX).sort()) {
  const dir = join(FIX, c);
  const key = JSON.parse(readFileSync(join(dir, 'key/KEY.json'), 'utf8'));
  const decoysFile = join(dir, 'key/DECOYS.json');
  const decoys = existsSync(decoysFile) ? JSON.parse(readFileSync(decoysFile, 'utf8')) : null;
  const lint = lintKey(key, decoys);
  const exampleMissing = key.defects.filter((d) => !d.detector.example).map((d) => d.id);
  // synthetic "good" report = the examples -> must score full recall, 0 false claims, severities agree
  const good = '## FINDINGS\n' + key.defects.map((d) => d.detector.example).join('\n') + '\n';
  const g = scoreReport(good, key, { decoys });
  // synthetic "bad" report = asserts each decoy as a defect (its statement) -> every decoy must be caught
  const bad = '## FINDINGS\n' + (decoys?.decoys ?? []).map((d, i) => `${i + 1}. [major] ${d.kind === 'unanswerable' ? d.example_violation : d.statement}`).join('\n') + '\n';
  const b = scoreReport(bad, key, { decoys });
  // negated phrasing must NOT count as a false claim
  const neg = '## FINDINGS\n' + (decoys?.decoys ?? []).map((d, i) => `${i + 1}. [minor] Asserted "${d.statement}": not present, evidence checked. UNVERIFIED.`).join('\n') + '\n';
  const n = scoreReport(neg, key, { decoys });
  // each example must match exactly one defect (no double counting)
  const multi = key.defects.map((d) => key.defects.filter((x) => (x.detector.any ?? []).some((re) => new RegExp(re, 'i').test(d.detector.example))).map((x) => x.id)).map((m, i) => [key.defects[i].id, m]).filter(([, m]) => m.length !== 1);
  const hints = walk(join(dir, 'fixture')).flatMap((f) => readFileSync(f, 'utf8').split('\n').map((l, i) => [f.replace(dir + '/', ''), i + 1, l]).filter(([, , l]) => HINT.test(l)));
  const keyInside = walk(join(dir, 'fixture')).filter((f) => /KEY\.json|DECOYS\.json|hidden\.test|\/reference\//.test(f));
  const sev = key.defects.reduce((m, d) => ((m[d.severity] = (m[d.severity] ?? 0) + 1), m), {});
  const bad_ok = (decoys?.decoys?.length ?? 0) === b.decoy_false_claims;
  const ok = !lint.length && !exampleMissing.length && g.recall_points === g.max_points && g.decoy_false_claims === 0 && g.severity_agreement_pct === 100 && bad_ok && n.decoy_false_claims === 0 && !multi.length && !keyInside.length;
  if (!ok) problems++;
  console.log(`${c}: ${ok ? 'OK' : 'PROBLEMS'} | defects ${key.defects.length} ${JSON.stringify(sev)} cross-file ${key.defects.filter((d) => d.cross_file).length} | decoys ${decoys?.decoys?.length ?? 0} | good: recall ${g.recall_points}/${g.max_points}, sev ${g.severity_agreement_pct}%, false ${g.decoy_false_claims} | bad: false claims ${b.decoy_false_claims} | negated: false ${n.decoy_false_claims}`);
  if (lint.length) console.log('  lint:', lint);
  if (exampleMissing.length) console.log('  no example:', exampleMissing);
  if (multi.length) console.log('  example matches != 1 defect:', JSON.stringify(multi));
  if (keyInside.length) console.log('  key material inside fixture:', keyInside);
  if (hints.length) console.log('  hint words in fixture:', hints.map(([f, i, l]) => `${f}:${i}: ${l.trim().slice(0, 90)}`));
}
process.exit(problems ? 1 : 0);
