#!/usr/bin/env node
// checks/spell.mjs — run cspell over subtitles + site copy, print JSON, exit 0 clean / 1 findings / 2 tool error.
// usage: node checks/spell.mjs [--root <dir>] [--config <cspell.json>] [glob ...]   (default glob: **/*.{srt,html})
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const root = resolve(opt('--root', '.'));
const config = resolve(opt('--config', 'cspell.json'));
const globs = argv.length ? argv : ['**/*.{srt,html}'];
let bin;
try { // package.json is not exported by cspell, so walk up from its main entry to the package root
  let d = dirname(createRequire(resolve(process.cwd(), 'package.json')).resolve('cspell'));
  while (!existsSync(join(d, 'package.json'))) d = dirname(d);
  bin = join(d, 'bin.mjs'); }
catch (e) { console.log(JSON.stringify({ ok: false, error: 'cspell not installed: ' + e.message })); process.exit(2); }
const args = [bin, 'lint', '--no-progress', '--no-color', '--quiet', '--no-summary', '--root', root, '--config', config, ...globs];
const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd: root, maxBuffer: 64 << 20 });
if (r.error || ![0, 1].includes(r.status)) {
  console.log(JSON.stringify({ ok: false, exit: r.status, error: (r.error?.message || '') + (r.stderr || '') + (r.stdout || '') }));
  process.exit(2);
}
const findings = [];
for (const line of r.stdout.split('\n')) {
  const m = line.match(/^(.+?):(\d+):(\d+) - Unknown word \((.+?)\)(?: fix: \((.+?)\))?/);
  if (m) findings.push({ file: m[1], line: +m[2], col: +m[3], word: m[4], suggestion: m[5] ?? null });
}
console.log(JSON.stringify({ ok: true, tool: 'cspell', root, config, count: findings.length, findings }, null, 2));
process.exit(findings.length ? 1 : 0);
