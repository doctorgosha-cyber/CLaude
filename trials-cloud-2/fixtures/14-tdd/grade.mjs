#!/usr/bin/env node
// Usage: node grade.mjs <run-dir>   → prints one JSON line {"score","passed","total","details"}
// Runs the 25 hidden cases in hidden/cases.mjs against <run-dir>/src/pricing.mjs in a child
// process (60 s timeout, TZ deliberately non-UTC). Leaves no files in the run dir.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDir = path.resolve(process.argv[2] || '.');
const modPath = path.join(runDir, 'src', 'pricing.mjs');
const TOTAL = 25;
const out = { score: 0, passed: 0, total: TOTAL, details: {} };

const scratch = path.join(runDir, '__grade__');
try {
  if (!existsSync(modPath)) {
    out.details.error = 'src/pricing.mjs not found';
  } else {
    const r = spawnSync(process.execPath, [path.join(here, 'hidden', 'runner.mjs'), modPath], {
      cwd: runDir, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, TZ: 'Pacific/Auckland', NODE_OPTIONS: '' },
    });
    if (r.error || r.status !== 0 && !r.stdout.trim()) {
      out.details.error = `runner failed: ${r.error ? r.error.message : 'exit ' + r.status} ${String(r.stderr).slice(0, 400)}`;
    } else {
      const line = r.stdout.trim().split('\n').pop();
      const parsed = JSON.parse(line);
      if (parsed.loadError) out.details.loadError = parsed.loadError;
      const tests = {};
      for (const t of parsed.results) {
        tests[t.id] = t.ok ? 'pass' : `FAIL: ${t.error}`;
        if (t.ok) out.passed++;
      }
      out.details.tests = tests;
      out.details.failed = parsed.results.filter((t) => !t.ok).map((t) => t.id);
    }
  }
} finally {
  if (existsSync(scratch)) rmSync(scratch, { recursive: true, force: true });
}
out.score = Number((out.passed / TOTAL).toFixed(4));
console.log(JSON.stringify(out));
