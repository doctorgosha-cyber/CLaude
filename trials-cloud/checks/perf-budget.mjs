#!/usr/bin/env node
// checks/perf-budget.mjs — Lighthouse performance run + our own budget (Lighthouse 12+ dropped budget audits).
// Usage: node checks/perf-budget.mjs <url> [--runs=3] [--lcp=2500] [--cls=0.1] [--tbt=300] [--fcp=1800] [--score=90]
// Takes the median of N runs. Exit 0 within budget, 1 over budget, 2 lighthouse failed. Prints JSON.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
const args = process.argv.slice(2); const url = args.find(a => !a.startsWith('--'));
const opt = (k, d) => Number((args.find(a => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1]);
const budget = { lcp: opt('lcp', 2500), cls: opt('cls', 0.1), tbt: opt('tbt', 300), fcp: opt('fcp', 1800), score: opt('score', 90) };
const runs = opt('runs', 3); const tmp = mkdtempSync(`${tmpdir()}/lh-`); const samples = [];
const lh = process.platform === 'win32' ? 'lighthouse.cmd' : 'lighthouse';
for (let i = 0; i < runs; i++) {
  const out = `${tmp}/run-${i}.json`;
  const r = spawnSync(lh, [url, '--only-categories=performance', '--output=json', `--output-path=${out}`, '--chrome-flags=--headless=new', '--quiet'], { encoding: 'utf8', env: process.env });
  if (r.status !== 0) { console.log(JSON.stringify({ ok: false, error: r.stderr.slice(-1500) })); process.exit(2); }
  const j = JSON.parse(readFileSync(out, 'utf8')); const a = j.audits;
  samples.push({ score: Math.round(j.categories.performance.score * 100), lcp: a['largest-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue, tbt: a['total-blocking-time'].numericValue, fcp: a['first-contentful-paint'].numericValue });
}
rmSync(tmp, { recursive: true, force: true });
const median = k => samples.map(s => s[k]).sort((x, y) => x - y)[Math.floor(samples.length / 2)];
const m = Object.fromEntries(Object.keys(budget).map(k => [k, median(k)]));
const over = Object.entries(budget).filter(([k, b]) => k === 'score' ? m[k] < b : m[k] > b).map(([k, b]) => ({ metric: k, value: m[k], budget: b }));
console.log(JSON.stringify({ ok: over.length === 0, url, runs, median: m, over, samples }, null, 2));
process.exit(over.length ? 1 : 0);
