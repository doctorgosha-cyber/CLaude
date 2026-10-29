#!/usr/bin/env node
// checks/vulns.mjs — known-vulnerability check for a project dir (Node lockfiles + Python requirements.txt).
// Primary: osv-scanner (offline DB, no api.osv.dev needed). Fallback: `npm audit --json` when osv-scanner is missing.
// Usage: node checks/vulns.mjs <dir> [--level high]   -> prints JSON, exit 0 clean / 1 findings / 2 tool error
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] || '.');
const level = process.argv.includes('--level') ? process.argv[process.argv.indexOf('--level') + 1] : 'high';
const OSV = process.env.OSV_SCANNER || 'osv-scanner';
const out = { tool: null, dir, findings: [], ok: false };

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, shell: process.platform === 'win32', ...opts });
}

const probe = run(OSV, ['--version']);
if (!probe.error && probe.status === 0) {
  out.tool = 'osv-scanner ' + probe.stdout.split('\n')[0].replace(/^osv-scanner version:\s*/, '');
  const r = run(OSV, ['scan', 'source', '--offline', '--download-offline-databases', '--format', 'json', '-r', dir]);
  // exit 0 = clean, 1 = vulns found, 127/128+ = tool/parse errors
  if (![0, 1].includes(r.status)) { out.error = (r.stderr || r.error?.message || '').trim(); console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  let j; try { j = JSON.parse(r.stdout); } catch { out.error = 'bad JSON from osv-scanner'; console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  for (const res of j.results || []) for (const p of res.packages || []) for (const v of p.vulnerabilities || [])
    out.findings.push({ file: res.source.path, package: p.package.name, version: p.package.version, ecosystem: p.package.ecosystem, id: v.id, aliases: v.aliases || [], summary: v.summary || '' });
} else {
  if (!existsSync(join(dir, 'package-lock.json'))) { out.error = 'osv-scanner not found and no package-lock.json for npm audit'; console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  out.tool = 'npm audit (fallback; cannot read requirements.txt)';
  const r = run('npm', ['audit', '--json', `--audit-level=${level}`], { cwd: dir });
  let j; try { j = JSON.parse(r.stdout); } catch { out.error = (r.stderr || '').trim(); console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  if (j.error) { out.error = j.error.summary || j.error.code; console.log(JSON.stringify(out, null, 2)); process.exit(2); }
  for (const [name, v] of Object.entries(j.vulnerabilities || {}))
    for (const via of v.via) if (typeof via === 'object') out.findings.push({ file: 'package-lock.json', package: name, range: v.range, severity: via.severity, id: via.url.split('/').pop(), summary: via.title });
}
out.ok = out.findings.length === 0;
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
