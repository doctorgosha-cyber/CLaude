#!/usr/bin/env node
// checks/gltf.mjs — validate every .glb/.gltf under a directory with the official Khronos glTF validator (npm: gltf-validator).
// Usage: node checks/gltf.mjs <dir> [--warn]   Prints a JSON report; exit 0 when no errors (with --warn: no errors or warnings), 1 otherwise.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
const validator = createRequire(import.meta.url)('gltf-validator'); // 2.0.0-dev.3.10, Apache-2.0
const dir = resolve(process.argv[2] ?? '.'); const failOnWarn = process.argv.includes('--warn');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(glb|gltf)$/i.test(n) ? [p] : []; });
const files = walk(dir); let failed = 0; const report = [];
for (const file of files) {
  let r;
  try {
    r = await validator.validateBytes(new Uint8Array(readFileSync(file)), { uri: basename(file), maxIssues: 0,
      externalResourceFunction: (uri) => Promise.resolve(new Uint8Array(readFileSync(join(dirname(file), decodeURIComponent(uri))))) });
  } catch (e) { report.push({ file, errors: 1, warnings: 0, issues: [{ code: 'INVALID_INPUT', severity: 0, message: String(e) }] }); failed++; continue; }
  const bad = r.issues.messages.filter((m) => m.severity === 0 || (failOnWarn && m.severity === 1));
  if (bad.length) failed++;
  report.push({ file, errors: r.issues.numErrors, warnings: r.issues.numWarnings, issues: bad.map((m) => ({ code: m.code, severity: m.severity, pointer: m.pointer, message: m.message })) });
}
console.log(JSON.stringify({ validator: validator.version(), dir, files: files.length, failed, report }, null, 2));
process.exit(failed ? 1 : 0);
