// Baseline: the team's home-made validator (field presence + primitive type checks only). Usage: node baseline.mjs catalogue.json
import { readFileSync } from 'node:fs';
const REQ = {
  id: 'string', brand: 'string', product: 'string', species: 'string', life_stage: 'string', form: 'string',
  kcal_per_100g: 'number', protein_pct: 'number', fat_pct: 'number', moisture_pct: 'number', fibre_pct: 'number',
  source_url: 'string', source_date: 'string', label_year: 'number',
};
const rows = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const findings = [];
if (!Array.isArray(rows)) { console.error('catalogue is not an array'); process.exit(2); }
rows.forEach((row, i) => {
  for (const [key, type] of Object.entries(REQ)) {
    if (!(key in row)) findings.push({ row: i, id: row.id, field: key, problem: 'missing' });
    else if (typeof row[key] !== type) findings.push({ row: i, id: row.id, field: key, problem: `expected ${type}, got ${typeof row[key]}` });
  }
});
console.log(JSON.stringify({ rows: rows.length, findings }, null, 2));
process.exit(findings.length ? 1 : 0);
