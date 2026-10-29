// Generator for the 01-catalogue fixtures: 40 pet-food rows, 10 seeded faults (F1..F10), 30 clean controls.
// Deterministic (seeded PRNG). Writes catalogue.json, catalogue.csv, catalogue-clean.json, catalogue-clean.csv, KEY.json
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let seed = 20261029;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const r1 = (lo, hi) => Math.round((lo + rnd() * (hi - lo)) * 10) / 10;
const brands = ['Acme Paws', 'Northfield', 'Bowl & Bone', 'Terra Vita', 'Silver Whisker', 'Hearth Pet', 'Oakridge', 'Marlow'];
const dogNames = ['Adult Chicken & Rice', 'Senior Light Turkey', 'Puppy Lamb', 'Grain-Free Salmon', 'Active Beef', 'Sensitive Duck'];
const catNames = ['Indoor Chicken', 'Kitten Salmon', 'Senior Turkey', 'Hairball Tuna', 'Sterilised Rabbit', 'Adult Beef'];
const stages = { dog: ['puppy', 'adult', 'senior'], cat: ['kitten', 'adult', 'senior'] };
const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const rows = [];
for (let i = 1; i <= 40; i++) {
  const species = i % 2 ? 'dog' : 'cat';
  const form = i % 3 === 0 ? 'wet' : 'dry';
  const id = 'P' + String(i).padStart(3, '0');
  const brand = pick(brands);
  const product = pick(species === 'dog' ? dogNames : catNames) + (form === 'wet' ? ' (pouch)' : ' (kibble)');
  let kcal, protein, fat, moisture, fibre;
  if (form === 'dry') {
    kcal = r1(340, 430); protein = species === 'cat' ? r1(30, 40) : r1(22, 32); fat = r1(10, 20); moisture = r1(7, 10); fibre = r1(2, 5);
  } else {
    kcal = r1(80, 120); protein = r1(9, 13); fat = r1(4, 7); moisture = r1(76, 82); fibre = r1(0.5, 1.5);
  }
  const year = pick([2023, 2024, 2025]);
  rows.push({ id, brand, product, species, life_stage: pick(stages[species]), form,
    kcal_per_100g: kcal, protein_pct: protein, fat_pct: fat, moisture_pct: moisture, fibre_pct: fibre,
    source_url: `https://example.com/products/${id.toLowerCase()}`,
    source_date: `${year}-${pick(months)}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`,
    label_year: year });
}
const clean = rows.map(r => ({ ...r }));
const byId = id => rows.find(r => r.id === id);
const KEY = { fixtures: { seeded: ['catalogue.json', 'catalogue.csv'], controls: ['catalogue-clean.json', 'catalogue-clean.csv'], clean_rows_in_seeded: 30, seeded_rows: 10 }, faults: [] };
const fault = (fid, id, field, what, cls, mech) => KEY.faults.push({ id: fid, row_id: id, field, what, class: cls, catch_by: mech });
// F1 unit: kJ value under kcal key (dry kibble ~380 kcal = ~1590 kJ)
byId('P001').kcal_per_100g = 1500;
fault('F1', 'P001', 'kcal_per_100g', 'kJ value (1500) stored under kcal_per_100g; true value ~360 kcal', 'unit-mismatch',
  { json_schema: 'maximum (tuned range dry 200-600)', frictionless: 'constraints.maximum (tuned)', custom: 'no (only because magnitude falls outside range)' });
// F2 unit: protein as g/kg
byId('P005').protein_pct = 280;
fault('F2', 'P005', 'protein_pct', 'protein given as g/kg (280) instead of % (28)', 'unit-mismatch',
  { json_schema: 'maximum (tuned, <=100 or tighter 60)', frictionless: 'constraints.maximum (tuned)', custom: 'no (magnitude outside range)' });
// F3 unit: moisture as fraction
byId('P007').moisture_pct = 0.1;
fault('F3', 'P007', 'moisture_pct', 'moisture as fraction 0.1 instead of 10 (%)', 'unit-mismatch',
  { json_schema: 'minimum (tuned, moisture >= 3)', frictionless: 'constraints.minimum (tuned)', custom: 'no (magnitude outside range); a fraction of 0.8 for wet food would also be caught by min, but note: a schema cannot see units, only magnitudes' });
// F4 impossible kcal
byId('P011').kcal_per_100g = 1200;
fault('F4', 'P011', 'kcal_per_100g', 'impossible 1200 kcal/100 g (pure fat is ~900)', 'impossible-value',
  { json_schema: 'maximum (tuned)', frictionless: 'constraints.maximum (tuned)', custom: 'no' });
// F5 missing source date
delete byId('P013').source_date;
fault('F5', 'P013', 'source_date', 'source_date missing (key absent in JSON, empty cell in CSV)', 'structural',
  { json_schema: 'required (default)', frictionless: 'constraints.required (default)', custom: 'no' });
// F6 duplicate id
byId('P017').id = 'P016';
fault('F6', 'P017 (now reads P016)', 'id', 'duplicate id: row 17 carries id P016, same as row 16', 'integrity',
  { json_schema: 'NOT expressible: uniqueItems compares whole objects, not one key across objects -> custom post-check', frictionless: 'constraints.unique or primaryKey (tuned)', custom: 'Ajv: yes; Frictionless: no' });
// F7 wrong species enum
byId('P019').species = 'puppy';
fault('F7', 'P019', 'species', 'species = "puppy" (not in dog|cat)', 'enum',
  { json_schema: 'enum (default)', frictionless: 'constraints.enum (default)', custom: 'no' });
// F8 negative moisture
byId('P023').moisture_pct = -5;
fault('F8', 'P023', 'moisture_pct', 'negative moisture (-5)', 'range',
  { json_schema: 'minimum (tuned)', frictionless: 'constraints.minimum (tuned)', custom: 'no' });
// F9 swapped protein/fat on dry kibble
Object.assign(byId('P025'), { protein_pct: 12, fat_pct: 32 });
fault('F9', 'P025', 'protein_pct/fat_pct', 'protein 12 and fat 32 on dry kibble (swapped); row rule protein_pct >= fat_pct when form == dry', 'cross-field',
  { json_schema: 'NOT expressible with standard keywords (no cross-property comparison) -> custom keyword / post-check', frictionless: 'row-constraint check (tuned, custom formula)', custom: 'both tools' });
// F10 stale label year
byId('P029').label_year = 2019;
fault('F10', 'P029', 'label_year', 'label_year 2019 (< 2022, stale label)', 'range',
  { json_schema: 'minimum 2022 (tuned)', frictionless: 'constraints.minimum (tuned)', custom: 'no (simple range, no custom logic needed)' });
KEY.note = 'Faults F1-F4, F8, F10 are caught only by numeric ranges (semantic faults a type-only schema cannot see). F6 needs custom logic in Ajv. F9 needs custom logic in both tools. F5 and F7 are the only faults a type/required/enum schema catches.';
const cols = Object.keys(clean[0]);
const csv = rs => [cols.join(','), ...rs.map(r => cols.map(c => {
  const v = r[c] === undefined ? '' : String(r[c]);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}).join(','))].join('\n') + '\n';
writeFileSync(join(here, 'catalogue.json'), JSON.stringify(rows, null, 2));
writeFileSync(join(here, 'catalogue.csv'), csv(rows));
writeFileSync(join(here, 'catalogue-clean.json'), JSON.stringify(clean, null, 2));
writeFileSync(join(here, 'catalogue-clean.csv'), csv(clean));
writeFileSync(join(here, 'KEY.json'), JSON.stringify(KEY, null, 2));
console.log('wrote 40 rows, 10 faults');
