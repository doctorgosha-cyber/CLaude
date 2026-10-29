import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricePerKg } from '../src/pricing.mjs';

test('pricePerKg: one currency marker, symbol or ISO code, before or after', () => {
  assert.deepEqual(pricePerKg('€10', '500 g'), { currency: 'EUR', perKg: 20 });
  assert.deepEqual(pricePerKg('10 £', '2 kg'), { currency: 'GBP', perKg: 5 });
  assert.deepEqual(pricePerKg('usd 8', '1 kg'), { currency: 'USD', perKg: 8 });
  assert.deepEqual(pricePerKg('8 CHF', '1 kg'), { currency: 'CHF', perKg: 8 });
  assert.deepEqual(pricePerKg('₴ 120', '1 kg'), { currency: 'UAH', perKg: 120 });
  assert.deepEqual(pricePerKg('¥500', '1 kg'), { currency: 'JPY', perKg: 500 });
  for (const bad of ['10', '$10 USD', '10 CAD', '$-10', '-€10', '$0', '€10 €']) {
    assert.throws(() => pricePerKg(bad, '1 kg'), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.throws(() => pricePerKg('$10', '0 g'), (e) => e instanceof TypeError && e.message.includes('0 g'));
});
