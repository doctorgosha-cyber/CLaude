#!/usr/bin/env node
// checks/php-static.mjs — phpstan (level 7 + WordPress stubs) and phpcs (WPCS) on a theme dir.
// Usage: node checks/php-static.mjs <theme-dir> [--level=7] [--phpcs-standard=WordPress-Extra]
// Exit 0 when clean, 1 when findings, 2 when a tool failed to run. Prints JSON.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const TOOLS = resolve(process.env.PHP_TOOLS ?? 'tools/php');          // dir holding phpstan.phar + vendor/
const dir = resolve(process.argv[2] ?? '.');
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
const level = arg('level', '7'), standard = arg('phpcs-standard', 'WordPress-Extra');

const neon = `${mkdtempSync(`${tmpdir()}/phpstan-`)}/phpstan.neon`;
writeFileSync(neon, `parameters:\n  level: ${level}\n  paths: [${JSON.stringify(dir)}]\n  scanFiles:\n    - ${TOOLS}/vendor/php-stubs/wordpress-stubs/wordpress-stubs.php\n`);
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });

const ps = run('php', [`${TOOLS}/phpstan.phar`, 'analyse', '-c', neon, '--no-progress', '--error-format=json']);
const cs = run(process.platform === 'win32' ? `${TOOLS}/vendor/bin/phpcs.bat` : `${TOOLS}/vendor/bin/phpcs`,
  ['--standard=' + standard, '-n', '--report=json', '--exclude=WordPress.Files.FileName,Generic.Files.LineLength', dir]);

const findings = [];
try {
  const j = JSON.parse(ps.stdout);
  for (const [file, v] of Object.entries(j.files ?? {})) for (const m of v.messages) findings.push({ tool: 'phpstan', file, line: m.line, msg: m.message });
} catch { console.log(JSON.stringify({ ok: false, error: 'phpstan did not return JSON', stderr: ps.stderr.slice(0, 2000) })); process.exit(2); }
try {
  const j = JSON.parse(cs.stdout);
  const seen = new Set();
  for (const [file, v] of Object.entries(j.files ?? {})) for (const m of v.messages) {
    const key = `${file}:${m.source}:${m.line}`; if (seen.has(key)) continue; seen.add(key);
    findings.push({ tool: 'phpcs', file, line: m.line, rule: m.source, msg: m.message });
  }
} catch { console.log(JSON.stringify({ ok: false, error: 'phpcs did not return JSON', stderr: cs.stderr.slice(0, 2000) })); process.exit(2); }

console.log(JSON.stringify({ ok: findings.length === 0, dir, level, standard, count: findings.length, findings }, null, 2));
process.exit(findings.length ? 1 : 0);
