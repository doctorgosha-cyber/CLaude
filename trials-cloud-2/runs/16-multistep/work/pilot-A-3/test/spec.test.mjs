// Regression tests for PS-418 against docs/PORTION-SPEC.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct } from '../src/catalogue.mjs';
import { parseEnergyUnit, lbToKg } from '../src/units.mjs';
import { roundGrams } from '../src/format.mjs';
import { dailyKcal } from '../src/needs.mjs';

function tmpCatalogue(products) {
  const file = join(mkdtempSync(join(tmpdir(), 'cat-')), 'catalogue.json');
  writeFileSync(file, JSON.stringify({ products }));
  return file;
}

test('spec §9 worked example matches exactly', () => {
  const res = handlePortion('species=cat&weight=4.2&stage=adult&product=ck-chicken-dry');
  assert.deepEqual(res.body, {
    grams: 66, kcalPerDay: 246.4, weight: 4.2, units: 'metric', capped: false, meals: 2, perMeal: 33,
    product: { id: 'ck-chicken-dry', name: 'Chicken & Rice Dry', kcalPer100g: 372 },
  });
});

test('imperial weight is converted to kg before the energy need (u_2291, u_0874)', () => {
  assert.ok(Math.abs(lbToKg(10) - 4.5359) < 1e-6);
  const imperial = handlePortion('species=cat&weight=10&units=imperial&stage=adult&product=ck-chicken-dry');
  const metric = handlePortion('species=cat&weight=4.5359&stage=adult&product=ck-chicken-dry');
  assert.equal(imperial.body.grams, metric.body.grams);
  assert.equal(imperial.body.weight, 10);
  assert.equal(imperial.body.units, 'imperial');
});

test('legacy stage aliases resolve; unknown stages are a 400, never guessed', () => {
  assert.equal(dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered_adult' }), dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered' }));
  assert.equal(handlePortion('species=cat&weight=4&stage=bogus&product=ck-chicken-dry').status, 400);
  assert.equal(handlePortion('species=cat&weight=4&stage=puppy&product=ck-chicken-dry').status, 400);
  assert.equal(handlePortion('species=cat&weight=1.5&stage=growth&product=ck-kitten-growth').body.meals, 3);
});

test('energy unit spellings from the feed are interpreted (u_1536: "kcal/kg ")', () => {
  assert.equal(parseEnergyUnit('kcal/kg '), 'perKg');
  assert.equal(parseEnergyUnit('kcal per kg'), 'perKg');
  assert.equal(parseEnergyUnit('KCAL / 100 G'), 'per100g');
  assert.equal(parseEnergyUnit('kcal per pouch'), 'perPack');
  assert.equal(parseEnergyUnit('kcal/can'), 'perPack');
  assert.equal(parseEnergyUnit('calories'), undefined);
  const products = loadCatalogue();
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'dg-beef-stew-wet').kcalPer100g, 97.5);
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
});

test('catalogue is refused for unknown units, per-can without pack_g, or implausible energy (PS-402)', () => {
  const base = { id: 'x', name: 'X', species: 'cat', added: '2026-01-01' };
  assert.throws(() => loadCatalogue(tmpCatalogue([{ ...base, form: 'dry', energy: { value: 380, unit: 'joules' } }])), /unknown energy unit/);
  assert.throws(() => loadCatalogue(tmpCatalogue([{ ...base, form: 'wet', energy: { value: 80, unit: 'kcal/can' } }])), /pack_g/);
  assert.throws(() => loadCatalogue(tmpCatalogue([{ ...base, form: 'semi-moist', energy: { value: 3850, unit: 'kcal/100g' } }])), /outside 250-600/);
  assert.throws(() => loadCatalogue(tmpCatalogue([{ ...base, form: 'wet', energy: { value: 380, unit: 'kcal/100g' } }])), /outside 60-150/);
  assert.equal(loadCatalogue(tmpCatalogue([{ ...base, form: 'wet', energy: { value: 80, unit: 'kcal/can', }, pack_g: 85 }]))[0].kcalPer100g, 80 / 85 * 100);
});

test('safety cap applies to dry food outside growth stages and never to wet food', () => {
  const capped = handlePortion('species=dog&weight=2&stage=adult&activity=high&product=dg-lamb-rice-dry');
  assert.equal(capped.body.grams, 60); // 3 % of 2 kg
  assert.equal(capped.body.capped, true);
  assert.equal(capped.body.perMeal, 30);
  const kitten = handlePortion('species=cat&weight=1.5&stage=kitten&product=ck-kitten-growth');
  assert.equal(kitten.body.capped, false);
  assert.ok(kitten.body.grams > 1.5 * 1000 * 0.025);
  const wet = handlePortion('species=cat&weight=4&stage=adult&product=ck-chicken-pate-wet');
  assert.equal(wet.body.capped, false);
  assert.equal(wet.body.cans, 3); // 258 g / 85 g
  assert.equal('cans' in capped.body, false);
});

test('rounding: whole grams, half away from zero, no scoop or minimum', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(42.4), 42);
  assert.equal(roundGrams(3), 3);
});
