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

test('pricePerKg: grouping and decimal-mark heuristics', () => {
  assert.equal(pricePerKg('$1,299.00', '1 kg').perKg, 1299);
  assert.equal(pricePerKg('1.299,00 €', '1 kg').perKg, 1299);
  assert.equal(pricePerKg('$1,299', '1 kg').perKg, 1299);
  assert.equal(pricePerKg('¥1,200', '1 kg').perKg, 1200);
  assert.equal(pricePerKg('29,99 €', '1 kg').perKg, 29.99);
  assert.equal(pricePerKg('$12.5', '1 kg').perKg, 12.5);
  assert.equal(pricePerKg('1.234.567 €', '1 kg').perKg, 1234567);
  assert.equal(pricePerKg('1 234,56 €', '1 kg').perKg, 1234.56);
  assert.equal(pricePerKg('₴ 1 234', '1 kg').perKg, 1234);
});

test('pricePerKg: dash after decimal mark means zero minor units', () => {
  assert.deepEqual(pricePerKg('CHF 12.–', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.equal(pricePerKg('CHF 12.-', '1 kg').perKg, 12);
  assert.equal(pricePerKg('12,— €', '1 kg').perKg, 12);
});
