#!/usr/bin/env node
// Usage: node grade.mjs <run-dir>   -> prints one JSON line {"score","passed","total","details"}
// Runs the hidden tests against <run-dir>/src and <run-dir>/data. Scratch files go to
// <run-dir>/__grade__/ which is removed afterwards. Deterministic, no network, < 90 s.
import { spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(process.argv[2] ?? '.');
const scratch = join(runDir, '__grade__');
const runner = join(HERE, 'hidden', 'run-tests.mjs');

function finish(details, score, passed, total) {
  rmSync(scratch, { recursive: true, force: true });
  console.log(JSON.stringify({ score, passed, total, details }));
}

if (!existsSync(join(runDir, 'src'))) finish({ error: `no src/ in ${runDir}` }, 0, 0, 0);
else {
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  const proc = spawnSync(process.execPath, [runner, runDir, scratch], {
    cwd: runDir,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, NODE_OPTIONS: '' },
    maxBuffer: 16 * 1024 * 1024,
  });
  const line = (proc.stdout || '').split('\n').find((l) => l.startsWith('__RESULT__'));
  if (!line) {
    finish({ error: 'runner produced no result', signal: proc.signal, stderr: String(proc.stderr).slice(-1200) }, 0, 0, 0);
  } else {
    const tests = JSON.parse(line.slice('__RESULT__'.length));
    const ids = Object.keys(tests);
    const passed = ids.filter((id) => tests[id].pass).length;
    const total = ids.length;
    const failed = Object.fromEntries(ids.filter((id) => !tests[id].pass).map((id) => [id, tests[id].error]));
    finish({ tests: Object.fromEntries(ids.map((id) => [id, tests[id].pass])), failed }, total ? +(passed / total).toFixed(4) : 0, passed, total);
  }
}
