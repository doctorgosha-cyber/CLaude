// Regression tests for PS-418 against docs/PORTION-SPEC.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct, normaliseProduct, parseEnergyUnit } from '../src/catalogue.mjs';
import { dailyKcal, resolveStage, isGrowthStage } from '../src/needs.mjs';
import { portionFor } from '../src/calculator.mjs';
import { roundGrams, roundKcal, roundCans, formatPortion } from '../src/format.mjs';

const rer = (kg) => 70 * kg ** 0.75;
const close = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) < eps, `expected ${b}, got ${a}`);

test('spec 1: imperial weight is pounds; need is computed from kg, weight/units echo the request', () => {
  const lb = handlePortion('species=cat&weight=10&stage=adult&units=imperial&product=ck-chicken-dry');
  const kg = handlePortion('species=cat&weight=4.5359&stage=adult&product=ck-chicken-dry');
  assert.equal(lb.status, 200);
  assert.equal(lb.body.weight, 10);
  assert.equal(lb.body.units, 'imperial');
  close(lb.body.kcalPerDay, kg.body.kcalPerDay, 0.11);
  assert.equal(lb.body.grams, kg.body.grams);
  assert.equal(lb.body.grams, Math.round((rer(10 / 2.20462) * 1.2) / 372 * 100));
});

test('spec 1: legacy stage aliases resolve; unknown stages are a 400, never guessed', () => {
  assert.equal(resolveStage('cat', 'neutered_adult'), 'neutered');
  assert.equal(resolveStage('cat', 'growth'), 'kitten');
  assert.equal(resolveStage('dog', 'puppy_growth'), 'puppy');
  assert.equal(resolveStage('dog', 'growth'), undefined); // kitten is not a dog stage
  assert.equal(resolveStage('cat', 'constructor'), undefined);
  close(dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered_adult' }), rer(4) * 1.0);
  const alias = handlePortion('species=cat&weight=4&stage=neutered_adult&product=ck-tuna-dry');
  const canon = handlePortion('species=cat&weight=4&stage=neutered&product=ck-tuna-dry');
  assert.deepEqual(alias.body, canon.body);
  for (const bad of ['puppy', 'teen', 'ADULT', 'constructor']) {
    const res = handlePortion(`species=cat&weight=4&stage=${bad}&product=ck-tuna-dry`);
    assert.equal(res.status, 400, bad);
    assert.match(res.body.error, /stage/);
  }
  assert.equal(handlePortion('species=cat&weight=4&activity=sleepy&product=ck-tuna-dry').status, 400);
});

test('spec 3: feed unit spellings are interpreted; per-kg and per-can convert to kcal/100g', () => {
  assert.equal(parseEnergyUnit('kcal/100g'), 'per100g');
  assert.equal(parseEnergyUnit('Kcal per 100 g'), 'per100g');
  assert.equal(parseEnergyUnit('kcal/kg '), 'perKg');
  assert.equal(parseEnergyUnit('kcal per kg'), 'perKg');
  assert.equal(parseEnergyUnit('kcal/can'), 'perPack');
  assert.equal(parseEnergyUnit('kcal per pouch'), 'perPack');
  assert.equal(parseEnergyUnit('kJ/100g'), undefined);
  assert.equal(parseEnergyUnit('kcal'), undefined);
  const products = loadCatalogue();
  assert.equal(products.length, 14);
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
  assert.equal(findProduct(products, 'dg-beef-stew-wet').kcalPer100g, 97.5);
});

test('spec 3: uninterpretable units, missing pack_g and implausible energy reject the product', () => {
  const base = { id: 'x', name: 'X', species: 'cat', form: 'dry' };
  assert.throws(() => normaliseProduct({ ...base, energy: { value: 370, unit: 'kJ/100g' } }), /uninterpretable/);
  assert.throws(() => normaliseProduct({ ...base, form: 'wet', energy: { value: 80, unit: 'kcal/can' } }), /pack_g/);
  assert.throws(() => normaliseProduct({ ...base, energy: { value: 3850, unit: 'kcal/100g' } }), /outside 250-600/);
  assert.throws(() => normaliseProduct({ ...base, energy: { value: 4120, unit: 'kcal/100g' } }), /outside/);
  assert.throws(() => normaliseProduct({ ...base, form: 'semi-moist', energy: { value: 200, unit: 'kcal/100g' } }), /outside/);
  assert.throws(() => normaliseProduct({ ...base, form: 'wet', energy: { value: 390, unit: 'kcal/100g' } }), /outside 60-150/);
  assert.throws(() => normaliseProduct({ ...base, form: 'frozen', energy: { value: 300, unit: 'kcal/100g' } }), /unknown form/);
  assert.equal(normaliseProduct({ ...base, form: 'wet', pack_g: 400, energy: { value: 390, unit: 'kcal/can' } }).kcalPer100g, 97.5);
  assert.equal(normaliseProduct({ ...base, energy: { value: 250, unit: 'kcal/100g' } }).kcalPer100g, 250);
  assert.equal(normaliseProduct({ ...base, energy: { value: 600, unit: 'kcal/100g' } }).kcalPer100g, 600);
});

test('spec 5: dry portions are capped at 2.5% (cat) / 3% (dog) of body weight, not growth, not wet', () => {
  const need = (rer(2) * 1.2 * 1.2) / 318 * 100; // 2 kg adult cat, high, Indoor Light -> ~53 g > 50 g cap
  assert.ok(need > 50 && need < 60);
  const res = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(res.body.grams, 50);
  assert.equal(res.body.capped, true);
  assert.equal(res.body.perMeal, 25);
  const under = handlePortion('species=cat&weight=3&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(under.body.capped, false); // 72.3 g need, 75 g cap
  assert.equal(under.body.grams, 72);
  const kitten = handlePortion('species=cat&weight=2&stage=growth&activity=high&product=ck-kitten-growth');
  assert.equal(kitten.body.capped, false);
  assert.ok(kitten.body.grams > 50);
  const wet = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-chicken-pate-wet');
  assert.equal(wet.body.capped, false);
  assert.ok(wet.body.grams > 50);
  const dog = portionFor({ species: 'dog', weightKg: 10, stage: 'adult', activity: 'high' }, { kcalPer100g: 250, form: 'dry' });
  assert.equal(dog.capped, true);
  assert.equal(dog.grams, 300);
  const ok = handlePortion('species=cat&weight=4.2&stage=adult&product=ck-chicken-dry');
  assert.equal(ok.body.capped, false);
  assert.equal(ok.body.grams, 66);
});

test('spec 6-8: meals, perMeal, cans and rounding', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(42.4), 42);
  assert.equal(roundGrams(3.2), 3); // no minimum portion, no scoop sizes
  assert.equal(roundGrams(0.5), 1);
  assert.equal(roundKcal(246.44), 246.4);
  assert.equal(roundKcal(246.45), 246.5);
  assert.equal(roundCans(1.65), 1.7);
  assert.equal(roundCans(1.64), 1.6);
  assert.equal(isGrowthStage('dog', 'puppy_growth'), true);
  assert.equal(isGrowthStage('dog', 'senior'), false);
  const adult = handlePortion('species=cat&weight=4.2&stage=adult&product=ck-chicken-dry').body;
  assert.equal(adult.meals, 2);
  assert.equal(adult.perMeal, 33);
  assert.equal('cans' in adult, false);
  const kitten = handlePortion('species=cat&weight=2&stage=kitten&product=ck-kitten-growth').body;
  assert.equal(kitten.meals, 3);
  assert.equal(kitten.perMeal, Math.round(kitten.grams / 3));
  const wet = handlePortion('species=cat&weight=4&stage=adult&product=ck-chicken-pate-wet').body;
  assert.equal(wet.meals, 2);
  assert.equal(wet.cans, roundCans(wet.grams / 85));
  assert.equal(wet.grams, Math.round((rer(4) * 1.2) / 92 * 100));
  const body = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', product: { id: 'x', name: 'X', kcalPer100g: 372, form: 'wet', packG: 85 }, capped: false, meals: 2 });
  assert.equal(body.cans, 0.8);
});

test('spec 9: response shape', () => {
  const res = handlePortion('species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.deepEqual(res.body, {
    grams: 66, kcalPerDay: 246.4, weight: 4.2, units: 'metric', capped: false, meals: 2, perMeal: 33,
    product: { id: 'ck-chicken-dry', name: 'Chicken & Rice Dry', kcalPer100g: 372 },
  });
});

test('PS-418: the four reported requests now match the spec', () => {
  const u2291 = handlePortion('species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry').body;
  assert.equal(u2291.grams, 70); // was 125
  const u0874 = handlePortion('species=cat&weight=11.5&stage=neutered_adult&activity=low&units=imperial&product=ck-senior-care').body;
  assert.equal(u0874.grams, 60); // was 130
  const u1536 = handlePortion('species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry').body;
  assert.equal(u1536.grams, 55); // was 20
  const u3078 = handlePortion('species=dog&weight=24&stage=adult&activity=normal&product=dg-senior-light').body;
  assert.equal(u3078.grams, 377); // was 375 (scoop rounding); capped stays false (cap 720 g)
  assert.equal(u3078.capped, false);
});
