// Regression tests for PS-418 against docs/PORTION-SPEC.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct } from '../src/catalogue.mjs';
import { parseEnergyUnit, lbToKg } from '../src/units.mjs';
import { dailyKcal, resolveStage, isGrowthStage } from '../src/needs.mjs';
import { roundGrams, roundKcal, roundCans } from '../src/format.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('§3 loader tolerates feed unit spellings and converts per kg / per can', () => {
  for (const u of ['kcal/kg', 'kcal/kg ', ' KCAL / KG', 'kcal per kg', 'kcal  per  kg']) assert.equal(parseEnergyUnit(u), 'perKg', u);
  for (const u of ['kcal/100g', 'kcal per 100 g', 'Kcal/100 g']) assert.equal(parseEnergyUnit(u), 'per100g', u);
  for (const u of ['kcal/can', 'kcal per pouch', 'kcal / can']) assert.equal(parseEnergyUnit(u), 'perPack', u);
  assert.equal(parseEnergyUnit('kcal/cup'), undefined);
  const products = loadCatalogue();
  assert.equal(products.length, 14);
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
  assert.equal(findProduct(products, 'dg-beef-stew-wet').kcalPer100g, 97.5);
  for (const p of products) {
    const [lo, hi] = p.form === 'wet' ? [60, 150] : [250, 600];
    assert.ok(p.kcalPer100g >= lo && p.kcalPer100g <= hi, `${p.id} ${p.kcalPer100g}`);
  }
});

test('§3 implausible energy, unknown unit or per-can without pack_g reject the catalogue', () => {
  assert.throws(() => loadCatalogue(join(FIX, 'implausible-catalogue.json')), /outside the plausible 250-600/);
  assert.throws(() => loadCatalogue(join(FIX, 'bad-unit-catalogue.json')), /unrecognised energy unit/);
  assert.throws(() => loadCatalogue(join(FIX, 'no-pack-catalogue.json')), /no pack_g/);
});

test('§1 imperial weight is pounds: computed in kg, echoed as sent (u_2291, u_0874)', () => {
  assert.ok(Math.abs(lbToKg(10) - 4.5359) < 1e-9);
  const a = handlePortion('species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry');
  assert.equal(a.status, 200);
  assert.equal(a.body.weight, 10);
  assert.equal(a.body.units, 'imperial');
  assert.equal(a.body.kcalPerDay, 261.1); // 70 * 4.5359^0.75 * 1.2
  assert.equal(a.body.grams, 70);
  const metric = handlePortion('species=cat&weight=4.5359&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.equal(metric.body.grams, a.body.grams);
  const b = handlePortion('species=cat&weight=11.5&stage=neutered_adult&activity=low&units=imperial&product=ck-senior-care');
  assert.equal(b.body.grams, 60);
  assert.equal(b.body.kcalPerDay, 205.4);
});

test('§1 stage aliases resolve, unknown stages are a 400, never guessed', () => {
  assert.equal(resolveStage('cat', 'neutered_adult'), 'neutered');
  assert.equal(resolveStage('dog', 'puppy_growth'), 'puppy');
  assert.equal(resolveStage('cat', 'growth'), 'kitten');
  assert.equal(resolveStage('cat', 'puppy'), undefined);
  assert.ok(isGrowthStage('cat', 'growth'));
  assert.ok(!isGrowthStage('cat', 'senior'));
  assert.throws(() => dailyKcal({ species: 'cat', weightKg: 4, stage: 'teenager' }), RangeError);
  const alias = handlePortion('species=cat&weight=4&stage=neutered_adult&product=ck-chicken-dry');
  const canon = handlePortion('species=cat&weight=4&stage=neutered&product=ck-chicken-dry');
  assert.equal(alias.body.kcalPerDay, 198); // factor 1.0, not adult 1.2
  assert.deepEqual(alias.body, canon.body);
  const bad = handlePortion('species=cat&weight=4&stage=teenager&product=ck-chicken-dry');
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /stage/);
  assert.equal(handlePortion('species=dog&weight=20&stage=kitten&product=dg-beef-dry').status, 400);
});

test('§8 rounding: whole grams half away from zero, no scoops, no minimum', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(42.4), 42);
  assert.equal(roundGrams(7), 7);
  assert.equal(roundKcal(246.45), 246.5);
  assert.equal(roundCans(1.55), 1.6);
  // u_1536: 3.8 kg adult cat on Ocean Fish Dry (412 kcal/100g) -> 228.6 kcal -> 55 g, not 20 g
  const r = handlePortion('species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry');
  assert.equal(r.body.kcalPerDay, 228.6);
  assert.equal(r.body.grams, 55);
});

test('§5 safety cap: dry food capped at 2.5% (cat) / 3% (dog) of body weight, not wet, not growth', () => {
  // 2 kg adult cat, high activity, Indoor Light 318 kcal/100g: 169.5 kcal -> 53.3 g > cap 50 g
  const capped = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(capped.body.capped, true);
  assert.equal(capped.body.grams, 50);
  assert.equal(capped.body.perMeal, 25);
  const kitten = handlePortion('species=cat&weight=2&stage=kitten&activity=high&product=ck-indoor-light');
  assert.equal(kitten.body.capped, false);
  assert.ok(kitten.body.grams > 50);
  const normal = handlePortion('species=cat&weight=4.2&stage=adult&product=ck-chicken-dry');
  assert.equal(normal.body.capped, false);
  const dog = handlePortion('species=dog&weight=5&stage=adult&activity=high&product=dg-senior-light');
  // 70*5^0.75*1.6*1.2 = 449.4 kcal -> 139.6 g < cap 150 g
  assert.equal(dog.body.capped, false);
  assert.equal(dog.body.grams, 140);
  const wet = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-chicken-pate-wet');
  assert.equal(wet.body.capped, false);
  assert.ok(wet.body.grams > 50);
});

test('§6-7-9 response shape: meals, perMeal, capped always present; cans for wet only', () => {
  const dry = handlePortion('species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.deepEqual(dry.body, {
    grams: 66, kcalPerDay: 246.4, weight: 4.2, units: 'metric', capped: false, meals: 2, perMeal: 33,
    product: { id: 'ck-chicken-dry', name: 'Chicken & Rice Dry', kcalPer100g: 372 },
  });
  const kitten = handlePortion('species=cat&weight=1.5&stage=growth&product=ck-kitten-growth');
  assert.equal(kitten.body.meals, 3);
  assert.equal(kitten.body.perMeal, roundGrams(kitten.body.grams / 3));
  const wet = handlePortion('species=cat&weight=5.5&stage=neutered_adult&activity=normal&product=ck-chicken-pate-wet');
  // 70*5.5^0.75*1.0 = 251.4 kcal -> 273.3 g -> 273 g -> 3.2 cans of 85 g
  assert.equal(wet.body.grams, 273);
  assert.equal(wet.body.cans, 3.2);
  assert.equal(wet.body.meals, 2);
  assert.equal(wet.body.perMeal, 137);
  const beefStew = handlePortion('species=dog&weight=10&stage=adult&product=dg-beef-stew-wet');
  assert.equal(beefStew.status, 200);
  assert.equal(typeof beefStew.body.cans, 'number');
});
