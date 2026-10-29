// Regression tests for PS-418 against docs/PORTION-SPEC.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct, normaliseProduct } from '../src/catalogue.mjs';
import { dailyKcal, resolveStage } from '../src/needs.mjs';
import { roundGrams, formatPortion } from '../src/format.mjs';
import { parseEnergyUnit } from '../src/units.mjs';

const ok = (q) => {
  const res = handlePortion(q);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};

test('u_2291 / u_0874: imperial weight is converted from pounds before the calculation', () => {
  const imperial = ok('species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry');
  const metric = ok('species=cat&weight=4.5359&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.equal(imperial.grams, metric.grams);
  assert.equal(imperial.weight, 10);
  assert.equal(imperial.units, 'imperial');
  assert.ok(imperial.grams > 55 && imperial.grams < 75, `grams ${imperial.grams}`);
});

test('u_1536: per-kg unit with stray spacing/wording is interpreted, not taken as per 100 g', () => {
  const products = loadCatalogue();
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
  assert.equal(findProduct(products, 'dg-beef-stew-wet').kcalPer100g, 97.5);
  const body = ok('species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry');
  assert.ok(body.grams > 50 && body.grams < 60, `grams ${body.grams}`);
  assert.equal(parseEnergyUnit('KCAL / 100 G'), 'per100g');
  assert.equal(parseEnergyUnit('kcal per kg'), 'perKg');
  assert.equal(parseEnergyUnit(' kcal/kg '), 'perKg');
  assert.equal(parseEnergyUnit('kcal per pouch'), 'perPack');
  assert.equal(parseEnergyUnit('joules'), undefined);
});

test('catalogue is refused for unknown units, missing pack_g and implausible energy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-'));
  const write = (products) => {
    const f = join(dir, 'c.json');
    writeFileSync(f, JSON.stringify({ products }));
    return f;
  };
  const base = { id: 'x', name: 'X', species: 'cat', form: 'dry' };
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 300, unit: 'kJ/100g' } }])), /unrecognised/);
  assert.throws(() => loadCatalogue(write([{ ...base, form: 'wet', energy: { value: 90, unit: 'kcal/can' } }])), /pack_g/);
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 3850, unit: 'kcal/100g' } }])), /outside/);
  assert.throws(() => loadCatalogue(write([{ ...base, form: 'wet', energy: { value: 300, unit: 'kcal/100g' } }])), /outside/);
  assert.equal(normaliseProduct({ ...base, form: 'wet', pack_g: 400, energy: { value: 390, unit: 'kcal/can' } }).kcalPer100g, 97.5);
});

test('u_0874: legacy stage aliases resolve; unknown stages are a 400, never guessed', () => {
  assert.equal(resolveStage('cat', 'neutered_adult'), 'neutered');
  assert.equal(resolveStage('dog', 'puppy_growth'), 'puppy');
  assert.equal(resolveStage('cat', 'puppy'), undefined);
  const alias = dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered_adult' });
  const direct = dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered' });
  assert.equal(alias, direct);
  assert.ok(Math.abs(alias - 198) < 0.1);
  assert.equal(handlePortion('species=cat&weight=4&stage=teenager&product=ck-chicken-dry').status, 400);
  assert.equal(handlePortion('species=cat&weight=4&stage=puppy&product=ck-chicken-dry').status, 400);
});

test('rounding is whole grams, half away from zero, with no scoop or minimum', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(42.4), 42);
  assert.equal(roundGrams(7), 7);
  const body = ok('species=dog&weight=24&stage=adult&activity=normal&product=dg-senior-light');
  assert.equal(body.grams, 377);
  assert.equal(body.capped, false);
  assert.equal(body.meals, 2);
  assert.equal(body.perMeal, 189);
});

test('safety cap applies to dry food for non-growth stages and carries capped: true', () => {
  const body = ok('species=cat&weight=4&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(body.grams, 90); // 285.1 kcal / 318 * 100 = 89.7 < 100 cap
  assert.equal(body.capped, false);
  const small = ok('species=cat&weight=2&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(small.capped, true);
  assert.equal(small.grams, 50);
  assert.equal(small.perMeal, 25);
  const kitten = ok('species=cat&weight=2&stage=growth&activity=high&product=ck-kitten-growth');
  assert.equal(kitten.capped, false);
  assert.equal(kitten.meals, 3);
  assert.equal(kitten.perMeal, roundGrams(kitten.grams / 3));
  assert.equal('cans' in kitten, false);
});

test('wet food: never capped, carries cans to one decimal', () => {
  const body = ok('species=cat&weight=5.5&stage=neutered_adult&activity=normal&product=ck-chicken-pate-wet');
  assert.equal(body.capped, false);
  assert.equal(body.grams, 273); // 251.4 kcal (neutered factor 1.0, not adult) / 92 * 100
  assert.equal(body.cans, 3.2);
  const dog = ok('species=dog&weight=21&stage=adult&activity=normal&product=dg-beef-stew-wet');
  assert.equal(dog.cans, Math.round((dog.grams / 400) * 10) / 10);
});

test('formatPortion shape matches spec section 9', () => {
  const body = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', capped: false, meals: 2,
    product: { id: 'ck-chicken-dry', name: 'Chicken & Rice Dry', kcalPer100g: 372, form: 'dry' } });
  assert.deepEqual(body, { grams: 66, kcalPerDay: 246.4, weight: 4.2, units: 'metric', capped: false, meals: 2, perMeal: 33,
    product: { id: 'ck-chicken-dry', name: 'Chicken & Rice Dry', kcalPer100g: 372 } });
});
