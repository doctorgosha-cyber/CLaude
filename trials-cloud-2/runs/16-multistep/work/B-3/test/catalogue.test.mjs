import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue, findProduct, normaliseProduct, parseEnergyUnit } from '../src/catalogue.mjs';

test('catalogue loads all products and converts per-kg energy', () => {
  const products = loadCatalogue();
  assert.equal(products.length, 14);
  const kitten = findProduct(products, 'ck-kitten-growth');
  assert.equal(kitten.kcalPer100g, 408);
  const chicken = findProduct(products, 'ck-chicken-dry');
  assert.equal(chicken.kcalPer100g, 372);
  assert.equal(chicken.form, 'dry');
});

test('catalogue: the 2026-10-20 products normalise despite odd unit spellings (PS-418)', () => {
  const products = loadCatalogue();
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412); // "kcal/kg "
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356); // "kcal per kg"
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
  const stew = findProduct(products, 'dg-beef-stew-wet'); // "kcal/can", 390 kcal in a 400 g can
  assert.equal(stew.kcalPer100g, 97.5);
  assert.equal(stew.form, 'wet');
  assert.equal(stew.packG, 400);
});

test('energy unit spellings: capitals, spaces and "per" are tolerated; junk is not', () => {
  for (const u of ['kcal/100g', 'kcal per 100 g', ' KCAL / 100 G ', 'kcal/100 g']) assert.equal(parseEnergyUnit(u), 'per100g', u);
  for (const u of ['kcal/kg', 'kcal/kg ', 'kcal per kg', 'Kcal / KG']) assert.equal(parseEnergyUnit(u), 'perKg', u);
  for (const u of ['kcal/can', 'kcal per pouch', 'kcal / can']) assert.equal(parseEnergyUnit(u), 'perPack', u);
  for (const u of ['kj/100g', 'kcal', 'kcal/lb', '', undefined, 'calories']) assert.equal(parseEnergyUnit(u), undefined, String(u));
});

test('catalogue is refused for uninterpretable units, per-can without pack_g, or implausible energy', () => {
  const base = { id: 'x', name: 'X', species: 'cat', form: 'dry' };
  assert.throws(() => normaliseProduct({ ...base, energy: { value: 380, unit: 'kJ/100g' } }), /unknown energy unit/);
  assert.throws(() => normaliseProduct({ ...base, form: 'wet', energy: { value: 90, unit: 'kcal/can' } }), /pack_g/);
  // 3850 "per 100 g" (the feed typo behind PS-418) must not load as a 3850 kcal/100 g food
  assert.throws(() => normaliseProduct({ ...base, form: 'semi-moist', energy: { value: 3850, unit: 'kcal/100g' } }), /plausible/);
  assert.throws(() => normaliseProduct({ ...base, form: 'wet', energy: { value: 372, unit: 'kcal/100g' } }), /plausible/);
  assert.throws(() => normaliseProduct({ ...base, energy: { value: 92, unit: 'kcal/100g' } }), /plausible/);
  assert.throws(() => normaliseProduct({ ...base, form: 'frozen', energy: { value: 372, unit: 'kcal/100g' } }), /unknown form/);
  assert.equal(normaliseProduct({ ...base, form: 'wet', pack_g: 85, energy: { value: 78, unit: 'kcal/pouch' } }).kcalPer100g, 78 / 85 * 100);
});
