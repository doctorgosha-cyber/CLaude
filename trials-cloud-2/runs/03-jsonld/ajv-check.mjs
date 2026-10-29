// Candidate (a): Ajv 8 + hand-written JSON Schema (schema.json) for Product/Offer/AggregateRating/Review/FAQPage.
// Usage: node ajv-check.mjs [--claims] file.html ...   (--claims adds page-claims.mjs = "tuned" config)
import { readFileSync } from 'node:fs';
import Ajv from 'ajv'; import addFormats from 'ajv-formats';
import { extractJsonLd, pageText } from './extract.mjs';
import { pageClaims } from './page-claims.mjs';
const schema = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
const validate = ajv.compile(schema);
const args = process.argv.slice(2); const claims = args.includes('--claims'); const files = args.filter(a => !a.startsWith('--'));
const out = {}; let total = 0; const t0 = performance.now();
for (const f of files) {
  const html = readFileSync(f, 'utf8'); const findings = []; const nodes = [];
  for (const b of extractJsonLd(html)) {
    let d; try { d = JSON.parse(b); } catch (e) { findings.push({ rule: 'json', msg: e.message }); continue; }
    for (const n of (Array.isArray(d) ? d : d['@graph'] || [d])) {
      nodes.push(n);
      if (!validate(n)) for (const e of validate.errors) {
        if (e.keyword === 'if' || e.keyword === 'oneOf' || /\/oneOf\/1\/type$/.test(e.schemaPath)) continue; // drop oneOf cascade noise
        findings.push({ rule: 'schema', type: n['@type'], path: e.instancePath || '/', msg: e.message, params: e.params });
      }
    }
  }
  if (claims) findings.push(...pageClaims(nodes, pageText(html), html));
  out[f.split('/').pop()] = findings; total += findings.length;
}
console.log(JSON.stringify({ runtime_ms: Math.round(performance.now() - t0), files: out }, null, 2));
process.exit(total ? 1 : 0);
