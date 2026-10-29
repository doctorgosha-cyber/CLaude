import test from 'node:test';
import assert from 'node:assert/strict';
import { roundKcal, formatPortion } from '../src/format.mjs';

test('response shape and kcal rounding', () => {
  assert.equal(roundKcal(246.44), 246.4);
  const body = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', product: { id: 'x', name: 'X', kcalPer100g: 372 } });
  assert.deepEqual(Object.keys(body).sort(), ['grams', 'kcalPerDay', 'product', 'units', 'weight']);
  assert.equal(body.kcalPerDay, 246.4);
});
