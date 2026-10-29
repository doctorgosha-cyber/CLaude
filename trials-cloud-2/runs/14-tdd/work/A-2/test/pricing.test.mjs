import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, pricePerKg, formatMoney, kcalPer100g, daysSupply, compare } from '../src/pricing.mjs';

const throwsWith = (fn, needle) =>
  assert.throws(fn, (e) => e instanceof TypeError && e.message.length > 0 && e.message.includes(needle));

test('toGrams: units, multipacks, compounds, whitespace', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('1,5 KG'), 1500);
  assert.equal(toGrams('400g'), 400);
  assert.equal(toGrams('  2 Kilograms '), 2000);
  assert.equal(toGrams('1 oz'), 28.349523125);
  assert.equal(toGrams('1 lb'), 453.59237);
  assert.equal(toGrams('2 lbs'), 2 * 453.59237);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
  assert.equal(toGrams('2 × 400 g'), 800);
  assert.equal(toGrams('3x400g'), 1200);
  assert.equal(toGrams('3 X 400 g'), 1200);
  assert.equal(toGrams('400 g (2 bags)'), 800);
  assert.equal(toGrams('85 g (12 pouches)'), 1020);
  for (const bad of ['0 g', '-1 kg', 'abc', '1 stone', '', '2 × 400 g (2 bags)', '0 × 400 g', '1,000.5 g']) {
    throwsWith(() => toGrams(bad), bad);
  }
  throwsWith(() => toGrams(42), '42');
  throwsWith(() => toGrams(null), 'null');
});

test('pricePerKg: currencies, grouping, unit prices', () => {
  assert.deepEqual(pricePerKg('$29.99', '400 g'), { currency: 'USD', perKg: 74.975 });
  assert.deepEqual(pricePerKg('29,99 €', '1 kg'), { currency: 'EUR', perKg: 29.99 });
  assert.deepEqual(pricePerKg('£1,299', '1 kg'), { currency: 'GBP', perKg: 1299 });
  assert.deepEqual(pricePerKg('¥1,200', '1 kg'), { currency: 'JPY', perKg: 1200 });
  assert.deepEqual(pricePerKg('EUR 1.299,00', '1 kg'), { currency: 'EUR', perKg: 1299 });
  assert.deepEqual(pricePerKg('usd 1,299.00', '1 kg'), { currency: 'USD', perKg: 1299 });
  assert.deepEqual(pricePerKg('1 234,56 ₴', '1 kg'), { currency: 'UAH', perKg: 1234.56 });
  assert.deepEqual(pricePerKg('CHF 12.–', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('12.- CHF', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('12,— chf', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('$12.5', '1 kg'), { currency: 'USD', perKg: 12.5 });
  assert.deepEqual(pricePerKg('$1.234.567', '1 kg'), { currency: 'USD', perKg: 1234567 });
  assert.deepEqual(pricePerKg('$10/kg', '400 g'), { currency: 'USD', perKg: 10 });
  assert.deepEqual(pricePerKg('$10 per KG', '400 g'), { currency: 'USD', perKg: 10 });
  assert.deepEqual(pricePerKg('$10 /lb', '400 g'), { currency: 'USD', perKg: 10 / 0.45359237 });
  for (const bad of ['10', '$10 €', '-$10', '$-10', '$0', '10 CAD', '$1,2,3.4.5', '$']) {
    throwsWith(() => pricePerKg(bad, '1 kg'), bad);
  }
  throwsWith(() => pricePerKg('$10/kg', '0 g'), '0 g');
});

test('formatMoney: layouts and rounding', () => {
  assert.equal(formatMoney(1234.5, 'EUR', 'de-DE'), '1.234,50 €');
  assert.equal(formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'en-US'), 'CHF 1,234.56');
  assert.equal(formatMoney(1234.56, 'EUR', 'fr-FR'), '1 234,56 €');
  assert.equal(formatMoney(1234.56, 'UAH', 'uk-UA'), '1 234,56 ₴');
  assert.equal(formatMoney(1234.5, 'JPY', 'en-US'), '¥1,234');
  assert.equal(formatMoney(1235.5, 'JPY', 'en-US'), '¥1,236');
  assert.equal(formatMoney(2.125, 'USD', 'en-US'), '$2.12');
  assert.equal(formatMoney(2.135, 'USD', 'en-US'), '$2.14');
  assert.equal(formatMoney(2.1251, 'USD', 'en-US'), '$2.13');
  assert.equal(formatMoney(0.005, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(0.015, 'USD', 'en-US'), '$0.02');
  assert.equal(formatMoney(0, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(1e-7, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(1e21, 'USD', 'en-US'), '$1,000,000,000,000,000,000,000.00');
  assert.equal(formatMoney(1e21, 'USD', 'en-US').includes(' '), false);
  throwsWith(() => formatMoney(-1, 'USD', 'en-US'), '-1');
  throwsWith(() => formatMoney(NaN, 'USD', 'en-US'), 'NaN');
  throwsWith(() => formatMoney('1', 'USD', 'en-US'), '1');
  throwsWith(() => formatMoney(1, 'CAD', 'en-US'), 'CAD');
  throwsWith(() => formatMoney(1, 'USD', 'en-GB'), 'en-GB');
});

test('kcalPer100g', () => {
  assert.equal(kcalPer100g('3500 kcal/kg'), 350);
  assert.equal(kcalPer100g('350 kcal/100 g'), 350);
  assert.equal(kcalPer100g('350kcal per 100g'), 350);
  assert.equal(kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);
  assert.equal(kcalPer100g('14640 KJ per KG'), 14640 / 4.184 / 10);
  assert.equal(kcalPer100g('50 kcal/100 g'), 50);
  assert.equal(kcalPer100g('900 kcal/100 g'), 900);
  for (const bad of ['49 kcal/100 g', '901 kcal/100 g', '350 kcal', '350 cal/100 g', '0 kcal/kg', '3500 kcal/100 g']) {
    throwsWith(() => kcalPer100g(bad), bad);
  }
});

test('daysSupply', () => {
  assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01');
  assert.equal(daysSupply(899, 300, '2026-01-30'), '2026-01-31');
  assert.equal(daysSupply(300, 300, '2026-01-30'), '2026-01-30');
  assert.equal(daysSupply('1 kg', '4 oz', '2024-02-28'), '2024-03-06'); // 8 days, leap year
  assert.equal(daysSupply(365 * 10, 10, '2023-01-01'), '2023-12-31');
  assert.equal(daysSupply(366 * 10, 10, '2024-01-01'), '2024-12-31');
  throwsWith(() => daysSupply(299, 300, '2026-01-30'), '299');
  throwsWith(() => daysSupply(900, 300, '2027-02-29'), '2027-02-29');
  throwsWith(() => daysSupply(900, 300, '2026-1-30'), '2026-1-30');
  throwsWith(() => daysSupply(900, 300, '2026-13-01'), '2026-13-01');
  throwsWith(() => daysSupply(0, 300, '2026-01-30'), '0');
  throwsWith(() => daysSupply(900, '0 g', '2026-01-30'), '0 g');
  throwsWith(() => daysSupply(900, 300, 20260130), '20260130');
});

test('compare', () => {
  const input = [
    { id: 'a', price: '€10', mass: '500 g' },
    { id: 'b', price: '$9', mass: '1 kg' },
    { id: 'c', price: 'nope', mass: '1 kg' },
    { id: 'd', price: '¥1,000', mass: '1 kg' },
    { id: 'e', price: '$9.0040', mass: '1 kg' },
    { id: 'f', price: '$1', mass: '0 g' },
  ];
  const copy = JSON.parse(JSON.stringify(input));
  const out = compare(input);
  assert.deepEqual(input, copy);
  assert.deepEqual(out, [
    { id: 'b', currency: 'USD', perKg: 9 },
    { id: 'e', currency: 'USD', perKg: 9 },
    { id: 'a', currency: 'EUR', perKg: 20 },
    { id: 'd', currency: 'JPY', perKg: 1000 },
    { id: 'c', currency: null, perKg: NaN },
    { id: 'f', currency: null, perKg: NaN },
  ]);
  assert.deepEqual(compare([{ id: 'x', price: '$29.99', mass: '400 g' }]), [{ id: 'x', currency: 'USD', perKg: 74.98 }]);
  assert.deepEqual(compare([]), []);
  throwsWith(() => compare('x'), 'x');
  throwsWith(() => compare(null), 'null');
});
