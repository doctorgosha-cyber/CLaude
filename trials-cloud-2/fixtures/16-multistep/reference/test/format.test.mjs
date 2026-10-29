import test from 'node:test';
import assert from 'node:assert/strict';
import { roundKcal, formatPortion } from '../src/format.mjs';

test('response carries grams, kcal (one decimal) and the product', () => {
  assert.equal(roundKcal(246.44), 246.4);
  const body = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', product: { id: 'x', name: 'X', kcalPer100g: 372 } });
  assert.equal(body.kcalPerDay, 246.4);
  assert.equal(typeof body.grams, 'number');
  assert.equal(body.product.id, 'x');
});
