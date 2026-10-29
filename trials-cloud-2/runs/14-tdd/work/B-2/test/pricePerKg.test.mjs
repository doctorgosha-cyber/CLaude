import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricePerKg } from '../src/pricing.mjs';

test('pricePerKg: symbol and ISO markers, before or after the number', () => {
  assert.deepEqual(pricePerKg('$29.99', '400 g'), { currency: 'USD', perKg: 74.975 });
  assert.deepEqual(pricePerKg('10 €', '500 g'), { currency: 'EUR', perKg: 20 });
  assert.deepEqual(pricePerKg('£5', '1 kg'), { currency: 'GBP', perKg: 5 });
  assert.deepEqual(pricePerKg('chf 8', '2 kg'), { currency: 'CHF', perKg: 4 });
  assert.deepEqual(pricePerKg('120₴', '600 g'), { currency: 'UAH', perKg: 200 });
  assert.deepEqual(pricePerKg(' 9 usd ', '1 kg'), { currency: 'USD', perKg: 9 });
});
