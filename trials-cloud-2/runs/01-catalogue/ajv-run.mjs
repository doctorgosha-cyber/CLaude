// Usage: node ajv-run.mjs <schema.json> <catalogue.json>  (custom keywords are registered but only used if the schema mentions them)
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const [schemaPath, dataPath] = process.argv.slice(2);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
const t0 = performance.now();
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
// custom keyword 1: cross-field row rule (protein >= fat); placed under then: for dry rows
ajv.addKeyword({ keyword: 'proteinGteFat', type: 'object', schemaType: 'boolean', errors: true,
  validate: function v(on, row) { v.errors = []; if (on && typeof row.protein_pct === 'number' && typeof row.fat_pct === 'number' && row.protein_pct < row.fat_pct)
    v.errors.push({ keyword: 'proteinGteFat', message: `protein_pct ${row.protein_pct} < fat_pct ${row.fat_pct} on dry food`, params: {} }); return v.errors.length === 0; } });
// custom keyword 2: uniqueness of one property across array items (uniqueItems cannot do this)
ajv.addKeyword({ keyword: 'uniqueKey', type: 'array', schemaType: 'string', errors: true,
  validate: function v(key, arr) { v.errors = []; const seen = new Map(); arr.forEach((it, i) => { const k = it && it[key]; if (seen.has(k)) v.errors.push({ keyword: 'uniqueKey', message: `duplicate ${key} "${k}" (rows ${seen.get(k)} and ${i})`, params: { key, value: k }, instancePath: `/${i}/${key}` }); else seen.set(k, i); }); return v.errors.length === 0; } });
const validate = ajv.compile(schema);
const ok = validate(data);
const errors = (validate.errors || []).map(e => { const m = /^\/(\d+)/.exec(e.instancePath || ''); const i = m ? Number(m[1]) : null;
  return { row: i, id: i != null && data[i] ? data[i].id : null, path: e.instancePath, keyword: e.keyword, message: e.message, params: e.params }; });
const ms = performance.now() - t0;
console.log(JSON.stringify({ ok, rows: data.length, validate_ms: Math.round(ms * 10) / 10, errors }, null, 2));
process.exit(ok ? 0 : 1);
