#!/usr/bin/env node
// Usage: node grade.mjs <run-dir>   -> prints one JSON line {"score","passed","total","details"}
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = process.env.PERF_TOOLS || '/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/11-perf';
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASELINE_SCORE = 27;   // Lighthouse performance score of the untouched task (median of 3, measured on the grading box)
const TARGET_SCORE = 95;
const LH_RUNS = Number(process.env.LH_RUNS || 3);

const runDir = path.resolve(process.argv[2] || '.');
if (!fs.existsSync(path.join(runDir, 'index.html'))) {
  console.log(JSON.stringify({ score: 0, passed: 0, total: 1, details: { error: 'index.html not found in ' + runDir } }));
  process.exit(0);
}

const require = createRequire(path.join(TOOLS, 'package.json'));
const { chromium } = require('playwright-core');
const { default: lighthouse } = await import(pathToFileURL(require.resolve('lighthouse')).href);
const chromeLauncher = await import(pathToFileURL(require.resolve('chrome-launcher')).href);
const { startServer } = await import(pathToFileURL(path.join(HERE, 'hidden', 'server.mjs')).href);
const { runFunctional } = await import(pathToFileURL(path.join(HERE, 'hidden', 'functional.mjs')).href);
const { runLighthouse } = await import(pathToFileURL(path.join(HERE, 'hidden', 'lighthouse.mjs')).href);
const expected = JSON.parse(fs.readFileSync(path.join(HERE, 'hidden', 'expected.json'), 'utf8'));

const server = await startServer(runDir);
let functional = [], lh = { median: null, all: [] }, lhError = null;
try {
  functional = await runFunctional({ chromium, executablePath: CHROME, url: server.url, expected });
  try {
    lh = await runLighthouse({ lighthouse, chromeLauncher, chromePath: CHROME, url: server.url, runs: LH_RUNS });
  } catch (e) { lhError = e.message; }
} finally {
  await server.close();
}

const passed = functional.filter(t => t.pass).length;
const total = functional.length;
const lhScore = lh.median ? lh.median.score : 0;
const clamp = (v) => Math.max(0, Math.min(1, v));
const perfScore = lh.median && !lh.median.runtime_error ? clamp((lhScore - BASELINE_SCORE) / (TARGET_SCORE - BASELINE_SCORE)) : 0;
const score = Math.round((0.5 * (total ? passed / total : 0) + 0.5 * perfScore) * 1000) / 1000;

console.log(JSON.stringify({
  score, passed, total,
  details: {
    functional_fraction: total ? Math.round(passed / total * 1000) / 1000 : 0,
    perf_score: Math.round(perfScore * 1000) / 1000,
    lighthouse_baseline: BASELINE_SCORE,
    lighthouse_target: TARGET_SCORE,
    lighthouse: lh.median,
    lighthouse_runs: lh.all.map(r => r.score),
    lighthouse_error: lhError,
    failed: functional.filter(t => !t.pass).map(t => `${t.name}${t.info ? ' — ' + t.info : ''}`),
    tests: functional.map(t => ({ name: t.name, pass: t.pass }))
  }
}));
