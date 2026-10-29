import test from 'node:test';
import assert from 'node:assert/strict';
import { roundKcal, roundGrams, roundCans, formatPortion } from '../src/format.mjs';

test('response carries grams, kcal (one decimal) and the product', () => {
  assert.equal(roundKcal(246.44), 246.4);
  const body = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', product: { id: 'x', name: 'X', kcalPer100g: 372, form: 'dry' } });
  assert.equal(body.kcalPerDay, 246.4);
  assert.equal(typeof body.grams, 'number');
  assert.equal(body.product.id, 'x');
});

test('rounding: whole grams half away from zero, no scoop size and no minimum portion', () => {
  assert.equal(roundGrams(42.5), 43);
  assert.equal(roundGrams(42.49), 42);
  assert.equal(roundGrams(5.5), 6);
  assert.equal(roundGrams(66.2), 66);
  assert.equal(roundGrams(377.16), 377);
  assert.equal(roundCans(1.55), 1.6);
  assert.equal(roundCans(1.64), 1.6);
});

test('response shape: capped, meals, perMeal always present; cans only for wet food', () => {
  const dry = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', capped: false, meals: 2, product: { id: 'x', name: 'X', kcalPer100g: 372, form: 'dry' } });
  assert.deepEqual(dry, { grams: 66, kcalPerDay: 246.4, weight: 4.2, units: 'metric', capped: false, meals: 2, perMeal: 33, product: { id: 'x', name: 'X', kcalPer100g: 372 } });
  const wet = formatPortion({ grams: 135.4, kcalPerDay: 124.6, weight: 3, units: 'metric', capped: false, meals: 3, product: { id: 'w', name: 'W', kcalPer100g: 92, form: 'wet', packG: 85 } });
  assert.equal(wet.grams, 135);
  assert.equal(wet.meals, 3);
  assert.equal(wet.perMeal, 45);
  assert.equal(wet.cans, 1.6);
});
