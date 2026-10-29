import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct, normaliseProduct } from '../src/catalogue.mjs';
import { roundGrams } from '../src/format.mjs';
import { energyUnitKind } from '../src/units.mjs';

test('PS-418: imperial weight is converted to kg (u_2291, u_0874)', () => {
  const r = handlePortion('species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry');
  assert.equal(r.status, 200);
  assert.equal(r.body.weight, 10);
  assert.equal(r.body.units, 'imperial');
  assert.ok(r.body.grams > 65 && r.body.grams < 75, `grams ${r.body.grams}`);
  const s = handlePortion('species=cat&weight=11.5&stage=neutered_adult&activity=low&units=imperial&product=ck-senior-care');
  assert.equal(s.status, 200);
  assert.ok(s.body.grams > 55 && s.body.grams < 65, `grams ${s.body.grams}`);
});

test('PS-418: legacy stage aliases resolve, unknown stages are rejected', () => {
  const a = handlePortion('species=cat&weight=4&stage=neutered_adult&product=ck-chicken-dry');
  const b = handlePortion('species=cat&weight=4&stage=neutered&product=ck-chicken-dry');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  assert.equal(handlePortion('species=cat&weight=4&stage=puppy&product=ck-chicken-dry').status, 400);
  assert.equal(handlePortion('species=cat&weight=4&stage=teenager&product=ck-chicken-dry').status, 400);
});

test('PS-418: feed unit spellings are interpreted (u_1536)', () => {
  assert.equal(energyUnitKind('kcal/kg '), 'perKg');
  assert.equal(energyUnitKind('kcal per kg'), 'perKg');
  assert.equal(energyUnitKind('Kcal per 100 g'), 'per100g');
  assert.equal(energyUnitKind('kcal/can'), 'perPack');
  assert.equal(energyUnitKind('kcal per pouch'), 'perPack');
  assert.equal(energyUnitKind('kj/100g'), undefined);
  const products = loadCatalogue();
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'dg-beef-stew-wet').kcalPer100g, 97.5);
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
  const r = handlePortion('species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry');
  assert.ok(r.body.grams > 50 && r.body.grams < 60, `grams ${r.body.grams}`);
});

test('PS-402: implausible or uninterpretable catalogue entries are refused', () => {
  const base = { id: 'x', name: 'X', species: 'cat' };
  assert.throws(() => normaliseProduct({ ...base, form: 'dry', energy: { value: 3850, unit: 'kcal/100g' } }), /outside/);
  assert.throws(() => normaliseProduct({ ...base, form: 'wet', energy: { value: 400, unit: 'kcal/100g' } }), /outside/);
  assert.throws(() => normaliseProduct({ ...base, form: 'wet', energy: { value: 90, unit: 'kcal/can' } }), /pack_g/);
  assert.throws(() => normaliseProduct({ ...base, form: 'dry', energy: { value: 400, unit: 'kJ/100g' } }), /unrecognised/);
});

test('spec: rounding, cap, meals and cans', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(3.2), 3);
  const big = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(big.body.capped, true);
  assert.equal(big.body.grams, 50);
  assert.equal(big.body.meals, 2);
  assert.equal(big.body.perMeal, 25);
  const kitten = handlePortion('species=cat&weight=1.5&stage=growth&product=ck-kitten-growth');
  assert.equal(kitten.body.capped, false);
  assert.equal(kitten.body.meals, 3);
  assert.ok(kitten.body.grams > 1.5 * 25, 'growth is never capped');
  const wet = handlePortion('species=cat&weight=4&stage=neutered&product=ck-chicken-pate-wet');
  assert.equal(wet.body.capped, false);
  assert.equal(wet.body.cans, Math.round((wet.body.grams / 85) * 10) / 10);
  assert.equal('cans' in big.body, false);
});
