#!/usr/bin/env node
// checks/css.mjs — lint theme CSS with stylelint (Node API). Usage: node checks/css.mjs [glob] [configFile]
// Prints JSON; exit 0 = clean, 1 = findings, 2 = tool error. Needs: npm i -D stylelint@17.16.0 stylelint-config-standard@40.0.0
import stylelint from 'stylelint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// resolve `extends` (stylelint-config-standard) from the repo root that holds node_modules, i.e. the parent of checks/
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = process.argv[2] ?? '**/*.css';
const configFile = process.argv[3] ?? path.resolve('.stylelintrc.json');
const t0 = performance.now();
try {
  const { results, errored } = await stylelint.lint({ files, configFile, formatter: 'json', configBasedir: repoRoot });
  const findings = [];
  for (const r of results) {
    const file = path.relative(process.cwd(), r.source);
    for (const w of r.warnings) findings.push({ file, line: w.line, col: w.column, rule: w.rule, severity: w.severity, text: w.text });
    for (const p of r.parseErrors ?? []) findings.push({ file, line: p.line, col: p.column, rule: 'parse-error', severity: 'error', text: p.text });
  }
  const errors = findings.filter((f) => f.severity === 'error').length;
  console.log(JSON.stringify({ tool: 'stylelint', files: results.length, errors, warnings: findings.length - errors,
    runtime_ms: Math.round(performance.now() - t0), findings }, null, 2));
  process.exit(errored || errors > 0 ? 1 : 0);
} catch (err) {
  console.log(JSON.stringify({ tool: 'stylelint', error: String(err?.message ?? err) }));
  process.exit(2);
}
