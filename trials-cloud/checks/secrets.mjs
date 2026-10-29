#!/usr/bin/env node
// checks/secrets.mjs — gitleaks over a working folder (not git history). Exit 0 clean, 1 leaks, 2 tool error. Prints JSON.
// Usage: node checks/secrets.mjs <folder> [--config=gitleaks.toml] [--gitleaks=/path/to/gitleaks]
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, relative } from 'node:path';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const folder = resolve(args.find(a => !a.startsWith('--')) ?? '.');
const bin = opt('gitleaks', process.env.GITLEAKS ?? (process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks'));
const config = opt('config', '');
const tmp = mkdtempSync(`${tmpdir()}/gitleaks-`); const report = `${tmp}/report.json`;
const cmd = ['dir', folder, '--redact', '--no-banner', '--exit-code', '1', '--report-format', 'json', '--report-path', report, ...(config ? ['--config', config] : [])];
const r = spawnSync(bin, cmd, { encoding: 'utf8' });
if (r.error || (r.status !== 0 && r.status !== 1)) { console.log(JSON.stringify({ ok: false, error: r.error?.message ?? r.stderr.slice(-2000) })); process.exit(2); }
let leaks = [];
try { leaks = JSON.parse(readFileSync(report, 'utf8') || '[]'); } catch { leaks = []; }
rmSync(tmp, { recursive: true, force: true });
const findings = leaks.map(l => ({ file: relative(folder, l.File), line: l.StartLine, rule: l.RuleID, description: l.Description }));
console.log(JSON.stringify({ ok: findings.length === 0, folder, count: findings.length, findings }, null, 2));
process.exit(findings.length ? 1 : 0);
