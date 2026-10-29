#!/usr/bin/env node
// checks/svgo.mjs  —  node checks/svgo.mjs <inDir> <outDir> [configPath=checks/svgo.config.mjs]
// Optimises every *.svg in <inDir> with the tuned config, writes to <outDir>, verifies that viewBox, <title>,
// every REFERENCED id (url(#x), href=#x, aria-labelledby, #x in <style>) and root role/aria-* attributes survived. Prints JSON; exit 0 when every file passed, 1 otherwise.
import fs from 'node:fs';
import path from 'node:path';
import { optimize, loadConfig } from 'svgo';

const [inDir, outDir, configPath = 'checks/svgo.config.mjs'] = process.argv.slice(2);
const config = await loadConfig(path.resolve(configPath));
const root = (s) => (s.match(/<svg\b[^>]*>/) || [''])[0];
const attr = (tag, n) => (tag.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
const ids = (s) => new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const refs = (s) => new Set([...s.matchAll(/(?:url\(\s*['"]?#|href="#)([\w:.-]+)/g), ...s.matchAll(/aria-labelledby="([^"]+)"/g), ...[...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].flatMap((m) => [...m[1].matchAll(/#([\w-]+)\s*[{,]/g)])].flatMap((m) => m[1].split(/\s+/)));
const title = (s) => (s.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1]?.trim();
const ariaRole = (tag) => [...tag.matchAll(/\s(role|aria-[\w-]+)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`).sort().join(' ');
fs.mkdirSync(outDir, { recursive: true });
const report = { files: [], failed: 0 };
for (const f of fs.readdirSync(inDir).filter((x) => x.endsWith('.svg')).sort()) {
  const src = fs.readFileSync(path.join(inDir, f), 'utf8');
  const out = optimize(src, { ...config, path: path.join(inDir, f) }).data;
  fs.writeFileSync(path.join(outDir, f), out);
  const problems = [];
  if (attr(root(src), 'viewBox') !== attr(root(out), 'viewBox')) problems.push('viewBox changed');
  if (title(src) !== title(out)) problems.push('title changed');
  if (ariaRole(root(src)) !== ariaRole(root(out))) problems.push('root role/aria changed');
  const outIds = ids(out); for (const id of refs(src)) if (!outIds.has(id)) problems.push(`referenced id lost: ${id}`);
  report.files.push({ file: f, before: Buffer.byteLength(src), after: Buffer.byteLength(out), ok: problems.length === 0, problems });
  if (problems.length) report.failed++;
}
console.log(JSON.stringify(report, null, 1));
process.exit(report.failed ? 1 : 0);
