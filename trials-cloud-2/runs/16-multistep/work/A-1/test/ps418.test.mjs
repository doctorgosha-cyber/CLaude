// Regression tests for PS-418 (daily portion way off after the 2026-10-20 catalogue release).
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct } from '../src/catalogue.mjs';
import { parseEnergyUnit } from '../src/units.mjs';
import { roundGrams } from '../src/format.mjs';

test('energy unit spellings from the feed are interpreted (u_1536: "kcal/kg " was read as per 100 g)', () => {
  assert.equal(parseEnergyUnit('kcal/kg '), 'perKg');
  assert.equal(parseEnergyUnit('kcal per kg'), 'perKg');
  assert.equal(parseEnergyUnit('KCAL / 100 G'), 'per100g');
  assert.equal(parseEnergyUnit('kcal per pouch'), 'perPack');
  assert.equal(parseEnergyUnit('kcal/fortnight'), undefined);
  const products = loadCatalogue();
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'dg-beef-stew-wet').kcalPer100g, 97.5);
  const res = handlePortion('species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry');
  assert.equal(res.body.grams, 55);
});

test('catalogue is refused for unknown units, per-pack without pack_g, or implausible energy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-'));
  const write = (products) => {
    const f = join(dir, `${Math.random()}.json`);
    writeFileSync(f, JSON.stringify({ products }));
    return f;
  };
  const base = { id: 'x', name: 'X', species: 'cat', form: 'dry' };
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 400, unit: 'kcal/bag' } }])), /unknown energy unit/);
  assert.throws(() => loadCatalogue(write([{ ...base, form: 'wet', energy: { value: 90, unit: 'kcal/can' } }])), /pack_g/);
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 3850, unit: 'kcal/100g' } }])), /plausible/);
  assert.throws(() => loadCatalogue(write([{ ...base, form: 'wet', energy: { value: 390, unit: 'kcal/100g' } }])), /plausible/);
  assert.equal(loadCatalogue(write([{ ...base, energy: { value: 3850, unit: 'kcal/kg' } }]))[0].kcalPer100g, 385);
});

test('imperial weight is converted to kg before the calculation; weight/units echo the request (u_2291, u_0874)', () => {
  const res = handlePortion('species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry');
  assert.equal(res.status, 200);
  assert.equal(res.body.weight, 10);
  assert.equal(res.body.units, 'imperial');
  assert.ok(Math.abs(res.body.kcalPerDay - 261.1) < 0.2, `kcal ${res.body.kcalPerDay}`);
  assert.equal(res.body.grams, 70);
});

test('legacy stage aliases resolve; unknown stages are a 400, never guessed (u_0874)', () => {
  const alias = handlePortion('species=cat&weight=4&stage=neutered_adult&activity=normal&product=ck-chicken-dry');
  const current = handlePortion('species=cat&weight=4&stage=neutered&activity=normal&product=ck-chicken-dry');
  assert.deepEqual(alias.body, current.body);
  assert.ok(Math.abs(alias.body.kcalPerDay - 198.0) < 0.1);
  const bad = handlePortion('species=cat&weight=4&stage=middle_aged&product=ck-chicken-dry');
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /stage/);
  // Alias for the other species is not valid here.
  assert.equal(handlePortion('species=cat&weight=4&stage=puppy_growth&product=ck-chicken-dry').status, 400);
});

test('rounding is whole grams, half away from zero, no scoops or minimum (u_3078: 377 g not 375)', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(42.4), 42);
  assert.equal(roundGrams(3), 3);
  const res = handlePortion('species=dog&weight=24&stage=adult&activity=normal&product=dg-senior-light');
  assert.equal(res.body.grams, 377);
  assert.equal(res.body.meals, 2);
  assert.equal(res.body.perMeal, 189);
  assert.equal(res.body.capped, false);
  assert.equal('cans' in res.body, false);
});

test('safety cap applies to dry food for non-growth stages; growth stages get 3 meals; wet food reports cans', () => {
  // 2 kg adult cat on high activity: uncapped ~ 76 g, cap is 2.5% of 2 kg = 50 g.
  const capped = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(capped.body.capped, true);
  assert.equal(capped.body.grams, 50);
  assert.equal(capped.body.perMeal, 25);
  // Same animal as a kitten: no cap, 3 meals.
  const kitten = handlePortion('species=cat&weight=2&stage=growth&activity=high&product=ck-kitten-growth');
  assert.equal(kitten.body.capped, false);
  assert.equal(kitten.body.meals, 3);
  assert.equal(kitten.body.perMeal, roundGrams(kitten.body.grams / 3));
  // Wet food: never capped, cans to one decimal.
  const wet = handlePortion('species=cat&weight=3.6&stage=kitten&activity=normal&product=ck-chicken-pate-wet');
  assert.equal(wet.body.capped, false);
  assert.equal(wet.body.grams, 497);
  assert.equal(wet.body.cans, 5.8);
});
