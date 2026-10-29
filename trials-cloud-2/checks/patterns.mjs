#!/usr/bin/env node
// checks/patterns.mjs — run the ast-grep rule set over paths and print JSON.
// Usage: node checks/patterns.mjs [path ...]   (default: .)   Exit 0 clean, 1 findings, 2 tool error.
// Needs @ast-grep/cli@0.51.0 as a devDependency (native binary; win32 optional deps ship on npm).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesDir = process.env.PATTERNS_RULES || path.join(here, 'patterns-rules');   // holds sgconfig.yml + rules/
const bin = process.env.AST_GREP || path.join(here, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'ast-grep.cmd' : 'ast-grep');
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['.'];

const r = spawnSync(bin, ['scan', '-c', path.join(rulesDir, 'sgconfig.yml'), '--json=compact', ...targets],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });
if (r.error || (r.status !== 0 && r.status !== 1) || !r.stdout.trim().startsWith('[')) {
  console.log(JSON.stringify({ tool: 'ast-grep', error: r.error?.message || r.stderr || `exit ${r.status}` }));
  process.exit(2);
}
let matches;
try { matches = JSON.parse(r.stdout); } catch (e) { console.log(JSON.stringify({ tool: 'ast-grep', error: 'bad JSON: ' + e.message })); process.exit(2); }
const findings = matches.map(m => ({
  rule: m.ruleId, severity: m.severity, file: m.file, line: m.range.start.line + 1, col: m.range.start.column + 1,
  text: m.text.replace(/\s+/g, ' ').slice(0, 160), message: m.message,
}));
console.log(JSON.stringify({ tool: 'ast-grep', rulesDir, targets, count: findings.length, findings }, null, 2));
process.exit(findings.length ? 1 : 0);
