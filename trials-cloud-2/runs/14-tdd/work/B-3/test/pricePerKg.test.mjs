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

test('pricePerKg: thousands grouping, decimal mark inference, dash minor units', () => {
  const kg = (p) => pricePerKg(p, '1 kg').perKg;
  assert.equal(kg('$1,299.00'), 1299);
  assert.equal(kg('€1.299,00'), 1299);
  assert.equal(kg('$1,299'), 1299);
  assert.equal(kg('¥1,200'), 1200);
  assert.equal(kg('€29,99'), 29.99);
  assert.equal(kg('$12.5'), 12.5);
  assert.equal(kg('€1.234.567'), 1234567);
  assert.equal(kg('UAH 1 234,50'), 1234.5);
  assert.equal(kg('UAH 1 234 567.5'), 1234567.5);
  assert.equal(kg('CHF 12.–'), 12);
  assert.equal(kg('CHF 12.-'), 12);
  assert.equal(kg('CHF 12,—'), 12);
  for (const bad of ['$1,2,3', '$1..2', '$12.', '$,5']) {
    assert.throws(() => pricePerKg(bad, '1 kg'), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
});
