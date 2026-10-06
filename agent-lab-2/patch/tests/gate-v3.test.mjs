import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signTest, discordantPairs, gateV3, checkKeyLock, ceilingCheck, fileSha256 } from '../scripts/lib/learn.mjs';
import { aggregate, scoreReport } from '../scripts/lib/grade.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('signTest: exact two-sided binomial values', () => {
  assert.equal(signTest(6, 6), 0.03125); // 2 / 64
  assert.equal(signTest(8, 9), 0.0390625); // 2 * 10 / 512
  assert.equal(signTest(9, 10), 0.021484375); // 2 * 11 / 1024
  assert.equal(signTest(5, 5), 0.0625); // 5/5 is not enough at alpha 0.05
  assert.equal(signTest(7, 9), 0.1796875);
  assert.equal(signTest(3, 6), 1); // capped at 1
  assert.equal(signTest(0, 0), 1); // no discordant pairs: no evidence
  assert.equal(signTest(1, 6), signTest(5, 6)); // symmetric
  assert.throws(() => signTest(7, 6));
});

const M = (found, agree, gtSev = 'major') => ({ gtSev, found, agree: agree ?? found.map((f) => (f ? true : null)) });
const ev = (per_defect, extra = {}) => ({ grading: 'scripted:grade.mjs@1', recall_points: 5, max_points: 6, severity_agreement_pct: 50, extras_valid: 0, extras_noise: 0, extras_false: 0, per_defect, ...extra });

test('discordantPairs: recall pairs by rep index, severity only where both rated', () => {
  const b = { D1: M([false, false, true]), D2: M([true, true, true], [false, false, true]) };
  const a = { D1: M([true, true, true]), D2: M([true, true, true], [true, false, false]) };
  assert.deepEqual(discordantPairs(b, a, 'recall'), { plus: 2, minus: 0, ties: 4, pairs: 6, unpaired: 0, defects_missing: [] });
  const s = discordantPairs(b, a, 'severity'); // D1 reps 1-2 not rated in before -> skipped
  assert.equal(s.plus, 1); assert.equal(s.minus, 1); assert.equal(s.pairs, 4);
  // blind-grader scores 0 / 0.5 / 1 also work
  assert.equal(discordantPairs({ X: { score: [0.5, 1] } }, { X: { score: [1, 1] } }, 'recall').plus, 1);
});

const sixUp = { D1: [M([false, false, false]), M([true, true, true])], D2: [M([false, false, false]), M([true, true, true])] };
const caseOf = (name, defs) => ({ case: name, before: ev(Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, v[0]]))), after: ev(Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, v[1]])), { recall_points: 5.5 }) });

test('gateV3: ACCEPT needs p <= 0.05 and the same sign on >= 2 cases', () => {
  const two = gateV3([caseOf('c1', { D1: sixUp.D1 }), caseOf('c2', { D2: sixUp.D2 })], { target: 'recall', reps: 3 });
  assert.equal(two.verdict, 'ACCEPT', two.reasons.join('; '));
  assert.equal(two.sign_test.p, 0.0313);
  assert.equal(two.cases_up, 2);
  // the same 6 pairs on ONE case: significant but only one case -> PROVISIONAL
  const one = gateV3([caseOf('c1', sixUp)], { target: 'recall', reps: 3 });
  assert.equal(one.verdict, 'PROVISIONAL');
  assert.ok(one.reasons.some((r) => /positive on 1 case/.test(r)));
});

test('gateV3: one flipped defect is PROVISIONAL, not ACCEPT (the v2 weakness)', () => {
  const flip = { D1: [M([false, true, true]), M([true, true, true])] };
  const r = gateV3([caseOf('c1', flip), caseOf('c2', flip)], { target: 'recall', reps: 3 });
  assert.equal(r.sign_test.discordant, 2);
  assert.equal(r.verdict, 'PROVISIONAL');
});

test('gateV3: no paired gain or a v2 veto is REJECT; missing data is PROVISIONAL at best', () => {
  const down = gateV3([caseOf('c1', { D1: [M([true, true, true]), M([false, false, false])] })], { target: 'recall', reps: 3 });
  assert.equal(down.verdict, 'REJECT');
  const veto = caseOf('c1', sixUp); veto.after.recall_points = 4; // severity target, but recall mean dropped
  assert.equal(gateV3([veto], { target: 'severity', reps: 3 }).verdict, 'REJECT');
  const noData = { case: 'old', before: { ...ev(null), per_defect: undefined, recall_points: 5 }, after: { ...ev(null), per_defect: undefined, recall_points: 6 } };
  const r = gateV3([noData], { target: 'recall', reps: 3 });
  assert.equal(r.verdict, 'PROVISIONAL');
  assert.ok(r.reasons.some((x) => /no per-defect data/.test(x)));
});

test('gateV3: token target keeps the v2 logic per case', () => {
  const b = { ...ev(null), recall_points: 6, tokens: 50000 }, a = { ...b, tokens: 40000 };
  assert.equal(gateV3([{ case: 'c1', before: b, after: a }], { target: 'tokens', reps: 3 }).verdict, 'ACCEPT');
  assert.equal(gateV3([{ case: 'c1', before: b, after: { ...b, tokens: 48000 } }], { target: 'tokens', reps: 3 }).verdict, 'REJECT');
});

test('checkKeyLock: refuses a missing lock and a key changed after lock', () => {
  const lock = { verdict: 'KEY_LOCK', label: 'L', case: 'cm-01', key_sha256: 'a'.repeat(64), decoys_sha256: null };
  assert.deepEqual(checkKeyLock({ label: 'L', case: 'cm-01', key_sha256: 'a'.repeat(64) }, [lock]), []);
  assert.match(checkKeyLock({ label: 'L', case: 'cm-01', key_sha256: 'b'.repeat(64) }, [lock])[0], /KEY\.json changed after lock/);
  assert.match(checkKeyLock({ label: 'L', case: 'cm-01', key_sha256: 'a'.repeat(64), decoys_sha256: 'c'.repeat(64) }, [lock])[0], /DECOYS\.json changed/);
  assert.match(checkKeyLock({ label: 'M', case: 'cm-01', key_sha256: 'a'.repeat(64) }, [lock])[0], /no KEY_LOCK/);
});

test('gate CLI v3 refuses eval files without a key lock; v2 stays the default', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gate3-'));
  const a = join(dir, 'a.json'), b = join(dir, 'b.json');
  const m = { ...ev({ D1: M([true]) }), label: 'no-such-label', case: 'cm-01', key_sha256: 'f'.repeat(64) };
  writeFileSync(a, JSON.stringify(m)); writeFileSync(b, JSON.stringify(m));
  const r = spawnSync(process.execPath, ['scripts/learn.mjs', 'gate', '--gate=v3', `--before=${a}`, `--after=${b}`, '--target=recall'], { encoding: 'utf8', cwd: ROOT });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /refused \(gate v3\)[\s\S]*no KEY_LOCK ledger row for no-such-label\/cm-01/);
  const bad = spawnSync(process.execPath, ['scripts/learn.mjs', 'gate', '--gate=v9', `--before=${a}`, `--after=${b}`, '--target=recall'], { encoding: 'utf8', cwd: ROOT });
  assert.equal(bad.status, 2);
});

test('ceilingCheck: thresholds are parameters; rep 1 can be judged alone', () => {
  assert.equal(ceilingCheck({ recall_points: 42, max_points: 42 }, { target: 'recall' }).ceiling, true);
  assert.equal(ceilingCheck({ recall_points: 39, max_points: 42 }, { target: 'recall' }).ceiling, false); // 0.929 < 0.95
  assert.equal(ceilingCheck({ recall_points: 19, max_points: 20 }, { target: 'recall' }).ceiling, true); // exactly 0.95
  assert.equal(ceilingCheck({ recall_points: 39, max_points: 42 }, { target: 'recall', threshold: 0.9 }).ceiling, true);
  assert.equal(ceilingCheck({ recall_points: 9.67, max_points: 10, per_rep: [10, 9, 10] }, { target: 'recall', rep: 2 }).ceiling, false);
  assert.equal(ceilingCheck({ severity_agreement_pct: 91 }, { target: 'severity' }).ceiling, true);
  assert.equal(ceilingCheck({ severity_agreement_pct: 80 }, { target: 'severity' }).ceiling, false);
  assert.throws(() => ceilingCheck({}, { target: 'tokens' }));
});

test('aggregate carries a per-defect x rep matrix for the paired gate', () => {
  const key = { defects: [{ id: 'D01', severity: 'major', detector: { any: ['noindex'] } }, { id: 'D02', severity: 'minor', detector: { any: ['alt'] } }] };
  const r1 = '## FINDINGS\n1. [major] [seo] noindex on page\n2. [major] [a11y] alt missing', r2 = '## FINDINGS\n1. [minor] [seo] noindex on page';
  const agg = aggregate([scoreReport(r1, key), scoreReport(r2, key)]);
  assert.deepEqual(agg.per_defect.D01, { gtSev: 'major', found: [true, true], agree: [true, false] });
  assert.deepEqual(agg.per_defect.D02, { gtSev: 'minor', found: [true, false], agree: [false, null] });
});

test('regress precheck: a ceiling baseline gets SKIPPED_CEILING and a below-ceiling one does not', () => {
  const root = mkdtempSync(join(tmpdir(), 'precheck-'));
  cpSync(join(ROOT, 'scripts'), join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'learning', 'regress'), { recursive: true });
  writeFileSync(join(root, 'learning', 'eval-set.json'), JSON.stringify({ cases: [] }));
  writeFileSync(join(root, 'learning', 'ledger.jsonl'), '');
  writeFileSync(join(root, 'learning', 'regress', 'pc.json'), JSON.stringify({ label: 'pc', cases: {
    'cm-a': { type: 'workspace', role: 'solo', metrics: { recall_points: 8, max_points: 8, severity_agreement_pct: 50, per_rep: [8] } },
    'cm-b': { type: 'workspace', role: 'solo', metrics: { recall_points: 9, max_points: 10, severity_agreement_pct: 50, per_rep: [9] } },
  } }));
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'regress.mjs'), 'precheck', 'pc', '--target=recall'], { encoding: 'utf8', cwd: root });
  assert.equal(r.status, 0, r.stderr);
  const rows = readFileSync(join(root, 'learning', 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].verdict, 'SKIPPED_CEILING');
  assert.equal(rows[0].case, 'cm-a');
  assert.equal(rows[0].role, 'solo');
  const run = JSON.parse(readFileSync(join(root, 'learning', 'regress', 'pc.json'), 'utf8'));
  assert.equal(run.cases['cm-b'].precheck.ceiling, false);
  // a lower threshold is a parameter: now cm-b (0.9) is at the ceiling too
  const r2 = spawnSync(process.execPath, [join(root, 'scripts', 'regress.mjs'), 'precheck', 'pc', '--target=recall', '--threshold=0.9', '--cases=cm-b'], { encoding: 'utf8', cwd: root });
  assert.equal(r2.status, 0, r2.stderr);
  assert.equal(readFileSync(join(root, 'learning', 'ledger.jsonl'), 'utf8').trim().split('\n').length, 2);
});

test('fileSha256 hashes bytes and returns null for an absent file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sha-'));
  writeFileSync(join(dir, 'k.json'), 'abc');
  assert.equal(fileSha256(join(dir, 'k.json')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(fileSha256(join(dir, 'none.json')), null);
});
