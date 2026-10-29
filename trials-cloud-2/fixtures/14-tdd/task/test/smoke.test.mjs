import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, pricePerKg } from '../src/pricing.mjs';

test('smoke: kg to grams and price per kg', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.deepEqual(pricePerKg('$29.99', '400 g'), { currency: 'USD', perKg: 74.975 });
});
