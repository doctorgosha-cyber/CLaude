import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricePerKg } from '../src/pricing.mjs';

test('pricePerKg: symbol and ISO markers before or after the number', () => {
  assert.deepEqual(pricePerKg('$29.99', '400 g'), { currency: 'USD', perKg: 74.975 });
  assert.deepEqual(pricePerKg('29.99 $', '400 g'), { currency: 'USD', perKg: 74.975 });
  assert.deepEqual(pricePerKg('€10', '500 g'), { currency: 'EUR', perKg: 20 });
  assert.deepEqual(pricePerKg('10€', '500 g'), { currency: 'EUR', perKg: 20 });
  assert.deepEqual(pricePerKg('£5', '1 kg'), { currency: 'GBP', perKg: 5 });
  assert.deepEqual(pricePerKg('¥1,200', '1 kg'), { currency: 'JPY', perKg: 1200 });
  assert.deepEqual(pricePerKg('₴ 100', '2 kg'), { currency: 'UAH', perKg: 50 });
  assert.deepEqual(pricePerKg('chf 12', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('12 uah', '1 kg'), { currency: 'UAH', perKg: 12 });
  assert.deepEqual(pricePerKg(' 8 EUR ', '2 × 500 g'), { currency: 'EUR', perKg: 8 });
});

test('pricePerKg: separator heuristics and dash minor units', () => {
  assert.equal(pricePerKg('$1,299.00', '1 kg').perKg, 1299);
  assert.equal(pricePerKg('€1.299,00', '1 kg').perKg, 1299);
  assert.equal(pricePerKg('$1,299', '1 kg').perKg, 1299);
  assert.equal(pricePerKg('€29,99', '1 kg').perKg, 29.99);
  assert.equal(pricePerKg('$12.5', '1 kg').perKg, 12.5);
  assert.equal(pricePerKg('€1.234.567', '1 kg').perKg, 1234567);
  assert.equal(pricePerKg('€1 234,50', '1 kg').perKg, 1234.5);
  assert.equal(pricePerKg('€1 234 567,5', '1 kg').perKg, 1234567.5);
  assert.equal(pricePerKg('CHF 12.–', '1 kg').perKg, 12);
  assert.equal(pricePerKg('CHF 12.-', '1 kg').perKg, 12);
  assert.equal(pricePerKg('12,— CHF', '1 kg').perKg, 12);
});

test('pricePerKg: unit prices bypass the mass but still validate it', () => {
  assert.deepEqual(pricePerKg('$10/kg', '400 g'), { currency: 'USD', perKg: 10 });
  assert.deepEqual(pricePerKg('$10 per KG', '400 g'), { currency: 'USD', perKg: 10 });
  assert.equal(pricePerKg('£2 / lb', '400 g').perKg, 2 / 0.45359237);
  assert.equal(pricePerKg('£2 per lb', '400 g').perKg, 2 / 0.45359237);
  assert.throws(() => pricePerKg('$10/kg', '0 g'), TypeError);
});

test('pricePerKg: invalid prices throw TypeError naming the input', () => {
  for (const bad of ['10', '$€10', '$10 EUR', '10 CAD', '-$10', '$-10', '$0', '$10-', '$1,2,3.4.5', '$', 'abc', '$1.2.3,4']) {
    assert.throws(() => pricePerKg(bad, '1 kg'), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.throws(() => pricePerKg(10, '1 kg'), TypeError);
  assert.throws(() => pricePerKg('$10', '1 banana'), (e) => e instanceof TypeError && e.message.includes('1 banana'));
});
