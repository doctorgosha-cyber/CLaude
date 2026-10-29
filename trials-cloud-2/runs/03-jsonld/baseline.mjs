// Baseline = what NEXUS does today: extract <script type="application/ld+json"> and JSON.parse it. Nothing else.
import { readFileSync } from 'node:fs';
import { extractJsonLd } from './extract.mjs';
const out = {}; let findings = 0;
for (const f of process.argv.slice(2)) {
  const html = readFileSync(f, 'utf8'); const blocks = extractJsonLd(html); const errs = [];
  if (!blocks.length) errs.push('no JSON-LD block');
  for (const b of blocks) { try { JSON.parse(b); } catch (e) { errs.push('JSON.parse: ' + e.message); } }
  out[f.split('/').pop()] = { blocks: blocks.length, errors: errs }; findings += errs.length;
}
console.log(JSON.stringify(out, null, 2)); process.exit(findings ? 1 : 0);
