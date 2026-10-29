#!/usr/bin/env node
// checks/jsonld.mjs — validate schema.org JSON-LD embedded in HTML files (Ajv 8 + schema.json beside this file) and
// check that rating/FAQ claims are backed by the page. Usage: node checks/jsonld.mjs <file.html ...>   exit 0 clean, 1 findings, 2 tool error
import { readFileSync } from 'node:fs'; import Ajv from 'ajv'; import addFormats from 'ajv-formats';
const norm = s => String(s).replace(/\s+/g, ' ').trim();
const text = h => norm(h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&(nbsp|#160);/g, ' '));
const blocks = h => [...h.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const walk = (n, fn) => Array.isArray(n) ? n.forEach(x => walk(x, fn)) : n && typeof n === 'object' && (fn(n), Object.values(n).forEach(v => walk(v, fn)));
let validate, out = {}, total = 0;
try { const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
  validate = ajv.compile(JSON.parse(readFileSync(new URL('./jsonld.schema.json', import.meta.url), 'utf8'))); } catch (e) { console.error('jsonld: ' + e.message); process.exit(2); }
for (const f of process.argv.slice(2)) {
  let html; try { html = readFileSync(f, 'utf8'); } catch (e) { console.error('jsonld: ' + e.message); process.exit(2); }
  const findings = [], nodes = [];
  for (const b of blocks(html)) { let d; try { d = JSON.parse(b); } catch (e) { findings.push({ rule: 'json', msg: e.message }); continue; }
    for (const n of Array.isArray(d) ? d : d['@graph'] || [d]) { nodes.push(n); if (!validate(n)) for (const e of validate.errors)
      if (!['if', 'oneOf'].includes(e.keyword) && !/\/oneOf\/1\/type$/.test(e.schemaPath)) findings.push({ rule: 'schema', type: n['@type'], path: e.instancePath || '/', msg: e.message }); } }
  const t = text(html); let hasReview = /itemprop\s*=\s*["']?review\b|class\s*=\s*["'][^"']*\breview\b/i.test(html);
  walk(nodes, n => { if (n['@type'] === 'Review') hasReview = true; });
  walk(nodes, n => { if (n.aggregateRating && !hasReview) findings.push({ rule: 'page-claims', msg: 'aggregateRating without any visible review (.review/[itemprop=review]) or Review node' });
    if (n['@type'] === 'FAQPage') for (const q of [].concat(n.mainEntity || [])) for (const s of [q.name, q.acceptedAnswer?.text]) if (s && !t.includes(norm(s))) findings.push({ rule: 'page-claims', msg: 'FAQ text not on page: ' + norm(s).slice(0, 60) }); });
  out[f] = findings; total += findings.length;
}
console.log(JSON.stringify({ findings: total, files: out }, null, 2)); process.exit(total ? 1 : 0);
