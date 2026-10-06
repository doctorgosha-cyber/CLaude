#!/usr/bin/env node
// Regression runner for the learning loop. NEXUS spawns the agents; this script does everything around them.
//   node scripts/regress.mjs list
//   node scripts/regress.mjs prepare <label> [--profile=lean|v0.2] [--cases=a,b] [--variant=path/to/extra-rules.md] [--reps=N]
//        -> workspaces (copy of page/spec/fixture dir only), task contracts (router picks the role), packets, grading folders
//        --reps=N creates N independent tasks per case (…-R1..RN) so a case can be run several times by the same role
//   node scripts/regress.mjs collect <label>       -> copies each report into its grading folder as REPORT-Z.md (REPORT-R<n>.md with reps)
//   node scripts/regress.mjs grade-build <label>   -> runs hidden tests for build cases (no model needed)
//   node scripts/regress.mjs grade <label> [--tokens=case:r1,r2,…] -> scripted grading (scripts/lib/grade.mjs) for cases whose key
//        carries detectors (type "workspace", or audit keys with detectors); writes learning/eval/REG-<label>-<case>.json for the gate
// Case type "workspace": { dir, key, decoys? } — the agent gets a copy of dir; key/decoys stay sealed in the grading folder.
//   node scripts/regress.mjs report <label> [--baseline=<label>]  -> table + per-case gate vs baseline
//   node scripts/regress.mjs baseline <label>      -> saves this label's metrics as the named baseline
//   node scripts/regress.mjs precheck <label> --target=recall|severity [--threshold=0.95|0.9] [--cases=…] [--role=…]
//        AL-02 ceiling precheck. 1st call: prepares a 1-rep baseline (spawn it, collect, grade). 2nd call: judges each
//        graded case; a case at the ceiling gets a SKIPPED_CEILING ledger row and `prepare --variant` then refuses it
//        (override: --force-ceiling). Key lock (AL-03): prepare hashes KEY/DECOYS (or GROUND-TRUTH) into a KEY_LOCK
//        ledger row before the first rep; grade stamps the hashes into the eval file; gate v3 compares them.
// Audit cases need one blind grader agent per case: its brief is state/grading/REG-<label>/<case>/GRADER-BRIEF.md.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, cpSync, appendFileSync } from 'node:fs';
import { scoreReport, aggregate } from './lib/grade.mjs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { decideRoute } from './lib/router.mjs';
import { gate, fileSha256, ceilingCheck } from './lib/learn.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const P = (...a) => join(ROOT, ...a);
const [cmd, label, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const i = a.indexOf('='); return [a.slice(2, i < 0 ? undefined : i), i < 0 ? true : a.slice(i + 1)]; }));
const set = JSON.parse(readFileSync(P('learning', 'eval-set.json'), 'utf8')).cases;
const pick = () => (flags.cases ? set.filter((c) => String(flags.cases).split(',').includes(c.id)) : set);
const runFile = (l) => P('learning', 'regress', `${l}.json`);
const readJson = (f, d = null) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d);
const need = (v, m) => { if (!v) { console.error(m); process.exit(2); } return v; };
const LEDGER = P('learning', 'ledger.jsonl');
const ledgerRows = () => (existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const ledgerAppend = (row) => appendFileSync(LEDGER, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n');
/** AL-03 key lock: first KEY_LOCK row per label/case wins; a later prepare with a different key is refused. */
function lockKey(label, cid, keyFile, decoysFile) {
  const key_sha256 = fileSha256(keyFile), decoys_sha256 = decoysFile ? fileSha256(decoysFile) : null;
  const prior = ledgerRows().find((r) => r.verdict === 'KEY_LOCK' && r.label === label && r.case === cid);
  if (prior && (prior.key_sha256 !== key_sha256 || (prior.decoys_sha256 ?? null) !== decoys_sha256)) {
    console.error(`refused: ${label}/${cid} key differs from its KEY_LOCK (${prior.at}); use a new label for a new key`); process.exit(2);
  }
  if (!prior) ledgerAppend({ verdict: 'KEY_LOCK', label, case: cid, key_sha256, decoys_sha256, reasons: [] });
  return { key_sha256, decoys_sha256 };
}

function brief(n) {
  return `# Regression grading brief
You are an independent, blind grader. Inputs in this folder: GROUND-TRUTH.json (${n} seeded defects + clean traps listed in _doc, which are NOT defects), page.html, REPORT-Z.md (one audit report).
Write GRADING.md and GRADING.json here.
- Detection per defect: 1 clearly identified; 0.5 only part of a compound defect or implied; 0 missed. Record the severity the report gave when detected.
- Extras (findings matching no defect): VALID (true, reasonable), NOISE (true but trivial, restated or duplicated), FALSE (not true of page.html; flagging a clean trap is FALSE).
- GRADING.md must contain a table "| ID | GT sev | Z | Evidence |" with cells like \`1 (major)\`, \`0.5 (minor)\` or \`0\`, and a section "### Z" with an Item | Class | Note table for extras.
- GRADING.json: { "Z": { "recall_points": n, "max_points": ${n}, "severity_agreement_pct": n, "extras_valid": n, "extras_noise": n, "extras_false": n, "criticals_given": n, "criticals_correct": n } }
`;
}

if (cmd === 'list') { for (const c of set) console.log(`${c.id.padEnd(16)} ${c.type.padEnd(6)} ${c.author.padEnd(18)} ${c.domains.join(',')}`); process.exit(0); }

if (cmd === 'prepare') {
  need(label, 'usage: prepare <label>');
  const profile = flags.profile ?? 'lean'; const run = { label, profile, variant: flags.variant ?? null, created: new Date().toISOString(), cases: {} };
  const extra = flags.variant ? readFileSync(P(flags.variant), 'utf8') : null;
  const reps = Math.max(1, Number(flags.reps ?? 1)); run.reps = reps;
  const ceilinged = ledgerRows().filter((r) => r.verdict === 'SKIPPED_CEILING');
  for (const c of pick()) {
    const roleFor = flags.role ?? c.role ?? (c.type === 'build' ? 'vulcan' : decideRoute({ domains: c.domains, size: c.domains.length > 1 ? 'large' : 'small', risk: 'medium' }).roles[0]);
    if (flags.variant && !flags['force-ceiling'] && ceilinged.some((r) => r.case === c.id && (r.role ?? roleFor) === roleFor)) { console.error(`skipped ${c.id}: a precheck found the ${roleFor} baseline at the ceiling (SKIPPED_CEILING in learning/ledger.jsonl); --force-ceiling to run anyway`); continue; }
    const proj = `regress-${label}-${c.id}`.toLowerCase(); const pd = P('projects', proj); mkdirSync(join(pd, 'site'), { recursive: true });
    const route = decideRoute({ domains: c.domains, size: c.domains.length > 1 ? 'large' : 'small', risk: 'medium' });
    const role = flags.role ?? c.role ?? (c.type === 'build' ? 'vulcan' : route.roles[0]); // --role=<id> runs another role on the same cases
    const baseId = `REG-${label}-${c.id}`.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
    let inputs, writes = [];
    if (c.type === 'build') {
      copyFileSync(P(c.spec), join(pd, 'SPEC.md')); inputs = [`projects/${proj}/SPEC.md`];
      writes = [`projects/${proj}/billing.mjs`];
    } else if (c.type === 'workspace') {
      cpSync(P(c.dir), join(pd, 'site'), { recursive: true }); inputs = [`projects/${proj}/site/ (READ ONLY; start with TASK.md)`];
    } else { copyFileSync(P(c.page), join(pd, 'site', 'index.html')); inputs = [`projects/${proj}/site/index.html (READ ONLY)`]; }
    writeFileSync(join(pd, 'BRIEF.md'), `# BRIEF - ${proj}\n- Regression case "${c.id}" (${c.type}). Task: ${c.task}\n`);
    writeFileSync(join(pd, 'PROTECTED-CONSTRAINTS.md'), '- inputs must not be changed\n');
    if (extra) mkdirSync(P('skills', 'project-specific', `variant-${label}`), { recursive: true }), writeFileSync(P('skills', 'project-specific', `variant-${label}`, 'SKILL.md'), extra);
    const roleSkills = JSON.parse(readFileSync(P('config', 'roles.json'), 'utf8')).roles[role]?.default_skills ?? [];
    const ids = [];
    for (let r = 1; r <= reps; r++) {
      const id = reps > 1 ? `${baseId}-R${r}` : baseId;
      const deliverables = c.type === 'build' ? [`projects/${proj}/billing.mjs`, `reports/${id}.md`] : [`reports/${id}.md`];
      // reviewer null: regression reps are graded blind afterwards; nobody reviews them (A10: no invented dorn/guilliman reviewers)
      const task = { task_id: id, run_id: `REG-${label}`, project: proj, owner_goal: c.task, assigned_agent: role, reviewer: null, review_mode: 'none', priority: 'high', profile,
        skills: extra ? [...roleSkills, `variant-${label}`] : undefined, id_prefix: 'R', depends_on: [], scope: c.task, inputs, protected_constraints: ['inputs unchanged'], deliverables,
        acceptance: ['report validates'], permission: c.type === 'build' ? 'WRITE_PROJECT' : 'READ_ONLY', writes, production_permission: false, owner_approval: null, rollback_plan: null };
      writeFileSync(P('tasks', 'inbox', `${id}.json`), JSON.stringify(task, null, 2));
      spawnSync(process.execPath, [P('scripts', 'nexus.mjs'), 'task', 'move', id, 'active'], { cwd: ROOT });
      spawnSync(process.execPath, [P('scripts', 'nexus.mjs'), 'packet', id], { cwd: ROOT });
      ids.push(id);
    }
    const gd = P('state', 'grading', `REG-${label}`, c.id); const lockSlot = {};
    if (c.type === 'audit') {
      mkdirSync(gd, { recursive: true });
      copyFileSync(P(c.gt), join(gd, 'GROUND-TRUTH.json')); copyFileSync(P(c.page), join(gd, 'page.html'));
      Object.assign(lockSlot, lockKey(label, c.id, join(gd, 'GROUND-TRUTH.json'), null));
      writeFileSync(join(gd, 'GRADER-BRIEF.md'), brief(JSON.parse(readFileSync(P(c.gt), 'utf8')).defects.length));
    } else if (c.type === 'workspace') {
      mkdirSync(gd, { recursive: true });
      copyFileSync(P(c.key), join(gd, 'KEY.json')); if (c.decoys) copyFileSync(P(c.decoys), join(gd, 'DECOYS.json'));
      Object.assign(lockSlot, lockKey(label, c.id, join(gd, 'KEY.json'), c.decoys ? join(gd, 'DECOYS.json') : null));
    }
    run.cases[c.id] = { type: c.type, task_id: ids[0], task_ids: ids, role, packet: `state/packets/${ids[0]}.md`, packets: ids.map((i) => `state/packets/${i}.md`), project: proj, ...lockSlot };
  }
  mkdirSync(P('learning', 'regress'), { recursive: true }); writeFileSync(runFile(label), JSON.stringify(run, null, 2));
  console.log(JSON.stringify({ label, profile, reps, spawn: Object.values(run.cases).flatMap((x) => x.packets.map((p) => `${x.role}: ${p}`)) }, null, 1));
  process.exit(0);
}

if (cmd === 'precheck') {
  need(label, 'usage: precheck <label> --target=recall|severity [--threshold=x] [--cases=a,b] [--role=r]');
  const target = need(flags.target, 'precheck needs --target=recall|severity');
  if (!existsSync(runFile(label))) {
    // phase 1: a plain 1-rep baseline (no variant), prepared by the normal prepare path
    const pass = rest.filter((a) => /^--(cases|role|profile)=/.test(a));
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'prepare', label, '--reps=1', ...pass], { cwd: ROOT, encoding: 'utf8' });
    process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? '');
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`precheck ${label}: 1-rep baseline prepared. Spawn it, then: regress collect ${label} && regress grade ${label} (or a blind grader for audit cases), then re-run this precheck.`);
    process.exit(0);
  }
  const pr = readJson(runFile(label)); let pending = 0; const rows = [];
  for (const [cid, x] of Object.entries(pr.cases)) {
    if (flags.cases && !String(flags.cases).split(',').includes(cid)) continue;
    let m = x.metrics;
    if (!m && x.type === 'audit') m = readJson(P('state', 'grading', `REG-${label}`, cid, 'GRADING.json'))?.Z ?? null;
    if (!m || m.error || m.recall_points == null) { pending++; console.log(cid.padEnd(16), 'not graded yet'); continue; }
    const c = ceilingCheck(m, { target, threshold: flags.threshold, rep: Array.isArray(m.per_rep) ? 1 : null });
    x.precheck = { ...c, at: new Date().toISOString() };
    if (c.ceiling) ledgerAppend({ verdict: 'SKIPPED_CEILING', proposal: flags.proposal ?? null, label, case: cid, role: x.role ?? null, target, threshold: c.threshold, baseline: { recall_points: m.recall_points, max_points: m.max_points, severity_agreement_pct: m.severity_agreement_pct, per_rep: m.per_rep ?? null }, reasons: [`baseline ${target} ${c.value} >= ${c.threshold}: no room to show a gain; candidate not run`] });
    rows.push(c); console.log(cid.padEnd(16), `${target} ${c.value} vs threshold ${c.threshold}:`, c.ceiling ? 'CEILING -> SKIPPED_CEILING (candidate refused)' : 'below ceiling -> run the candidate');
  }
  writeFileSync(runFile(label), JSON.stringify(pr, null, 2));
  process.exit(pending ? 2 : 0);
}

const run = need(readJson(runFile(label)), `unknown label ${label}; run prepare first`);
const reportNames = (x) => (x.task_ids ?? [x.task_id]).map((id, i) => ({ id, name: (x.task_ids?.length ?? 1) > 1 ? `REPORT-R${i + 1}.md` : 'REPORT-Z.md' }));

if (cmd === 'collect') {
  for (const [cid, x] of Object.entries(run.cases)) if (x.type === 'audit' || x.type === 'workspace') {
    const gd = P('state', 'grading', `REG-${label}`, cid);
    for (const { id, name } of reportNames(x)) { const src = P('reports', `${id}.md`); console.log(cid, id, existsSync(src) ? (copyFileSync(src, join(gd, name)), 'copied') : 'MISSING report'); }
  }
  process.exit(0);
}

if (cmd === 'grade') {
  // Scripted, blind: the key's detectors score each collected report; extras stay unlabelled until a model grader labels them.
  const tokenMap = Object.fromEntries(String(flags.tokens ?? '').split(';').filter(Boolean).map((s) => { const [k, v] = s.split(':'); return [k, v.split(',').map(Number)]; }));
  mkdirSync(P('learning', 'eval'), { recursive: true });
  for (const [cid, x] of Object.entries(run.cases)) {
    const gd = P('state', 'grading', `REG-${label}`, cid);
    const key = readJson(join(gd, 'KEY.json')) ?? readJson(join(gd, 'GROUND-TRUTH.json'));
    if (!key?.defects?.some((d) => d.detector)) { console.log(cid.padEnd(16), 'no detectors in key; needs a blind model grader'); continue; }
    const decoys = readJson(join(gd, 'DECOYS.json'));
    const labels = readJson(join(gd, 'LABELS.json'));
    const reps = [];
    reportNames(x).forEach(({ name }, i) => { const f = join(gd, name); if (existsSync(f)) reps.push(scoreReport(readFileSync(f, 'utf8'), key, { decoys, labels: labels?.per_report?.[name] ?? labels, tokens: tokenMap[cid]?.[i] ?? null })); });
    if (!reps.length) { console.log(cid.padEnd(16), 'no reports collected'); continue; }
    x.metrics = aggregate(reps);
    const hashes = { key_sha256: fileSha256(existsSync(join(gd, 'KEY.json')) ? join(gd, 'KEY.json') : join(gd, 'GROUND-TRUTH.json')), decoys_sha256: fileSha256(join(gd, 'DECOYS.json')) };
    const evalFile = P('learning', 'eval', `REG-${label}-${cid}.json`); writeFileSync(evalFile, JSON.stringify({ ...x.metrics, label, case: cid, role: x.role, ...hashes }, null, 2));
    console.log(cid.padEnd(16), `reps ${reps.length}: recall ${x.metrics.recall_points}/${x.metrics.max_points} (${x.metrics.per_rep.join('/')})  severity ${x.metrics.severity_agreement_pct}%  false ${x.metrics.extras_false}  unlabelled extras ${x.metrics.extras_unlabelled}  -> ${evalFile.replace(ROOT, '')}`);
  }
  writeFileSync(runFile(label), JSON.stringify(run, null, 2)); process.exit(0);
}

if (cmd === 'grade-build') {
  for (const [cid, x] of Object.entries(run.cases)) if (x.type === 'build') {
    const c = set.find((s) => s.id === cid); const cand = P('projects', x.project, 'billing.mjs');
    if (!existsSync(cand)) { x.metrics = { error: 'no billing.mjs' }; continue; }
    const d = mkdtempSync(join(tmpdir(), 'reg-')); copyFileSync(cand, join(d, 'billing.mjs')); copyFileSync(P(c.tests), join(d, 'hidden.test.mjs'));
    const r = spawnSync(process.execPath, ['--test', 'hidden.test.mjs'], { cwd: d, encoding: 'utf8', timeout: 60000 }); rmSync(d, { recursive: true, force: true });
    const t = (r.stdout ?? '') + (r.stderr ?? ''); const n = (k) => Number((t.match(new RegExp(`ℹ ${k} (\\d+)`)) ?? [])[1] ?? 0);
    x.metrics = { tests: n('tests'), pass: n('pass'), fail: n('fail') }; console.log(cid, JSON.stringify(x.metrics));
  }
  writeFileSync(runFile(label), JSON.stringify(run, null, 2)); process.exit(0);
}

if (cmd === 'report' || cmd === 'baseline') {
  for (const [cid, x] of Object.entries(run.cases)) if (x.type === 'audit') {
    const g = readJson(P('state', 'grading', `REG-${label}`, cid, 'GRADING.json')); if (g?.Z) x.metrics = g.Z;
  }
  writeFileSync(runFile(label), JSON.stringify(run, null, 2));
  if (cmd === 'baseline') { const bf = P('learning', 'baselines.json'); const b = readJson(bf, {}); b[label] = Object.fromEntries(Object.entries(run.cases).map(([k, v]) => [k, v.metrics ?? null])); writeFileSync(bf, JSON.stringify(b, null, 2)); console.log(`baseline "${label}" saved`); process.exit(0); }
  const base = flags.baseline ? readJson(P('learning', 'baselines.json'), {})[flags.baseline] : null;
  let regressions = 0;
  for (const [cid, x] of Object.entries(run.cases)) {
    const m = x.metrics; if (!m) { console.log(cid.padEnd(16), 'not graded yet'); continue; }
    if (x.type === 'build') { const b = base?.[cid]; const bad = b && m.pass < b.pass; regressions += bad ? 1 : 0; console.log(cid.padEnd(16), `tests ${m.pass}/${m.tests}`, b ? `baseline ${b.pass}/${b.tests}` : '', bad ? 'REGRESSION' : ''); continue; }
    const line = `recall ${m.recall_points}/${m.max_points}  severity ${m.severity_agreement_pct}%  noise ${m.extras_noise}  false ${m.extras_false}`;
    if (base?.[cid]) { const r = gate(base[cid], m, { target: 'recall', minGain: { recall: -0.05 }, reps: 1 }); const bad = r.verdict === 'REJECT'; regressions += bad ? 1 : 0; console.log(cid.padEnd(16), line, '|', bad ? `REGRESSION: ${r.reasons.join('; ')}` : 'ok vs baseline'); }
    else console.log(cid.padEnd(16), line);
  }
  console.log(regressions ? `${regressions} regression(s)` : 'no regressions');
  process.exit(regressions ? 1 : 0);
}
console.error('usage: regress.mjs list | prepare <label> [--reps=N] | precheck <label> --target=recall|severity | collect <label> | grade <label> | grade-build <label> | report <label> [--baseline=x] | baseline <label>'); process.exit(2);
