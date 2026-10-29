#!/usr/bin/env node
// checks/catalogue.mjs — validate the pet-food catalogue with Ajv 8 + tuned JSON Schema + two custom keywords.
// Usage: node checks/catalogue.mjs data/catalogue.json [schema.json]   Exit: 0 clean, 1 findings, 2 tool/input error.
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const [dataPath, schemaPath = new URL('./catalogue.schema.json', import.meta.url)] = process.argv.slice(2);
let out;
try {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
  const rows = JSON.parse(readFileSync(dataPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  ajv.addKeyword({ keyword: 'proteinGteFat', type: 'object', schemaType: 'boolean', errors: true,   // row rule: dry food protein >= fat
    validate: function v(on, row) { v.errors = on && row.protein_pct < row.fat_pct ? [{ keyword: 'proteinGteFat', message: `protein ${row.protein_pct} < fat ${row.fat_pct}`, params: {} }] : []; return !v.errors.length; } });
  ajv.addKeyword({ keyword: 'uniqueKey', type: 'array', schemaType: 'string', errors: true,          // one property unique across all rows
    validate: function v(key, arr) { const seen = new Map(); v.errors = []; arr.forEach((r, i) => { if (seen.has(r[key])) v.errors.push({ keyword: 'uniqueKey', message: `duplicate ${key} ${r[key]} (rows ${seen.get(r[key])}, ${i})`, params: {}, instancePath: `/${i}/${key}` }); else seen.set(r[key], i); }); return !v.errors.length; } });
  const validate = ajv.compile(schema); const ok = validate(rows);
  const errors = (validate.errors || []).filter(e => e.keyword !== 'if');   // 'if' wrapper errors only repeat the then/else error
  out = { file: String(dataPath), rows: rows.length, ok, findings: errors.map(e => { const i = Number((e.instancePath.match(/^\/(\d+)/) || [])[1]);
    return { row: i, id: rows[i]?.id ?? null, path: e.instancePath, rule: e.keyword, message: e.message }; }) };
} catch (err) { console.error(JSON.stringify({ error: err.message })); process.exit(2); }
console.log(JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
