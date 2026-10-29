import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toGrams, pricePerKg, formatMoney, kcalPer100g, daysSupply, compare,
} from '../src/pricing.mjs';

const throwsWith = (fn, text) =>
  assert.throws(fn, (e) => e instanceof TypeError && e.message.length > 0 && e.message.includes(text));

test('toGrams: units, compounds, multipacks, whitespace', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('1,2 KG'), 1200);
  assert.equal(toGrams('400g'), 400);
  assert.equal(toGrams('  2 Kilograms '), 2000);
  assert.equal(toGrams('1 oz'), 28.349523125);
  assert.equal(toGrams('1 lb'), 453.59237);
  assert.equal(toGrams('2 lbs'), 2 * 453.59237);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
  assert.equal(toGrams('2 × 400 g'), 800);
  assert.equal(toGrams('3x100g'), 300);
  assert.equal(toGrams('2 X 400 g'), 800);
  assert.equal(toGrams('400 g (2 bags)'), 800);
  assert.equal(toGrams('85 g (12 pouches)'), 1020);
  for (const bad of ['0 g', '-1 kg', '1 stone', '', 'kg', '0 × 400 g', '1e3 g', '1.2.3 kg']) {
    throwsWith(() => toGrams(bad), bad);
  }
  throwsWith(() => toGrams(42), '42');
  throwsWith(() => toGrams(null), 'null');
});

test('pricePerKg: currencies, grouping, unit prices', () => {
  assert.deepEqual(pricePerKg('$29.99', '400 g'), { currency: 'USD', perKg: 74.975 });
  assert.deepEqual(pricePerKg('€10', '500 g'), { currency: 'EUR', perKg: 20 });
  assert.deepEqual(pricePerKg('10 €', '1 kg'), { currency: 'EUR', perKg: 10 });
  assert.deepEqual(pricePerKg('£1,299.00', '1 kg'), { currency: 'GBP', perKg: 1299 });
  assert.deepEqual(pricePerKg('1.299,00 €', '1 kg'), { currency: 'EUR', perKg: 1299 });
  assert.deepEqual(pricePerKg('1 299,00 ₴', '1 kg'), { currency: 'UAH', perKg: 1299 });
  assert.deepEqual(pricePerKg('¥1,200', '1 kg'), { currency: 'JPY', perKg: 1200 });
  assert.deepEqual(pricePerKg('usd 1,299', '1 kg'), { currency: 'USD', perKg: 1299 });
  assert.deepEqual(pricePerKg('29,99 EUR', '1 kg'), { currency: 'EUR', perKg: 29.99 });
  assert.deepEqual(pricePerKg('12.5 chf', '1 kg'), { currency: 'CHF', perKg: 12.5 });
  assert.deepEqual(pricePerKg('CHF 12.–', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('12.- CHF', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('CHF 1.299,—', '1 kg'), { currency: 'CHF', perKg: 1299 });
  assert.deepEqual(pricePerKg('1.299.000 €', '1 kg'), { currency: 'EUR', perKg: 1299000 });
  assert.deepEqual(pricePerKg('$20/kg', '400 g'), { currency: 'USD', perKg: 20 });
  assert.deepEqual(pricePerKg('$20 per KG', '400 g'), { currency: 'USD', perKg: 20 });
  assert.deepEqual(pricePerKg('$10 / lb', '400 g'), { currency: 'USD', perKg: 10 / 0.45359237 });
  assert.deepEqual(pricePerKg('$10 per lb', '400 g'), { currency: 'USD', perKg: 10 / 0.45359237 });
  throwsWith(() => pricePerKg('$20/kg', '0 g'), '0 g');
  for (const bad of ['29.99', '$29.99 €', '€ 0', '-$5', '$-5', '₽100', '$5-', 'USD', '$1,2,3.4']) {
    throwsWith(() => pricePerKg(bad, '1 kg'), bad);
  }
  throwsWith(() => pricePerKg(5, '1 kg'), '5');
});

test('formatMoney: rounding and locale layouts', () => {
  assert.equal(formatMoney(1234.5, 'EUR', 'de-DE'), '1.234,50 €');
  assert.equal(formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'en-US'), 'CHF 1,234.56');
  assert.equal(formatMoney(1234.56, 'EUR', 'fr-FR'), '1 234,56 €');
  assert.equal(formatMoney(1234.56, 'UAH', 'uk-UA'), '1 234,56 ₴');
  assert.equal(formatMoney(1234.56, 'CHF', 'fr-FR'), '1 234,56 CHF');
  assert.equal(formatMoney(1234.5, 'JPY', 'en-US'), '¥1,234');
  assert.equal(formatMoney(1235.5, 'JPY', 'de-DE'), '1.236 ¥');
  assert.equal(formatMoney(2.125, 'USD', 'en-US'), '$2.12');
  assert.equal(formatMoney(2.135, 'USD', 'en-US'), '$2.14');
  assert.equal(formatMoney(2.1251, 'USD', 'en-US'), '$2.13');
  assert.equal(formatMoney(0.005, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(0.015, 'USD', 'en-US'), '$0.02');
  assert.equal(formatMoney(999.995, 'USD', 'en-US'), '$1,000.00');
  assert.equal(formatMoney(0, 'GBP', 'en-US'), '£0.00');
  assert.equal(formatMoney(1e21, 'USD', 'en-US'), '$1,000,000,000,000,000,000,000.00');
  assert.equal(formatMoney(1e-7, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(1234567, 'USD', 'en-US'), '$1,234,567.00');
  // never a plain U+0020
  for (const loc of ['en-US', 'de-DE', 'fr-FR', 'uk-UA']) {
    for (const cur of ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH']) {
      assert.ok(!formatMoney(1234567.89, cur, loc).includes(' '));
    }
  }
  // matches Intl's layout for the rounded value
  for (const loc of ['en-US', 'de-DE', 'fr-FR', 'uk-UA']) {
    for (const cur of ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH']) {
      const ref = new Intl.NumberFormat(loc, { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' });
      assert.equal(formatMoney(1234.5, cur, loc), ref.format(cur === 'JPY' ? 1234 : 1234.5));
    }
  }
  throwsWith(() => formatMoney(-1, 'USD', 'en-US'), '-1');
  throwsWith(() => formatMoney(NaN, 'USD', 'en-US'), 'NaN');
  throwsWith(() => formatMoney('1', 'USD', 'en-US'), '1');
  throwsWith(() => formatMoney(1, 'XXX', 'en-US'), 'XXX');
  throwsWith(() => formatMoney(1, 'USD', 'en-GB'), 'en-GB');
});

test('kcalPer100g: normalisation and range', () => {
  assert.equal(kcalPer100g('3500 kcal/kg'), 350);
  assert.equal(kcalPer100g('350 kcal/100 g'), 350);
  assert.equal(kcalPer100g('350kcal/100g'), 350);
  assert.equal(kcalPer100g('350 KCAL per 100 G'), 350);
  assert.equal(kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);
  assert.equal(kcalPer100g('14640 kJ per kg'), 14640 / 4.184 / 10);
  assert.equal(kcalPer100g('50 kcal/100 g'), 50);
  assert.equal(kcalPer100g('900 kcal/100 g'), 900);
  for (const bad of ['49.9 kcal/100 g', '901 kcal/100 g', '350 kcal', '350 kcal/g', '0 kcal/kg', '350 cal/100 g']) {
    throwsWith(() => kcalPer100g(bad), bad);
  }
  throwsWith(() => kcalPer100g(350), '350');
});

test('daysSupply: inclusive counting, calendar validation', () => {
  assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01');
  assert.equal(daysSupply(300, 300, '2026-01-30'), '2026-01-30');
  assert.equal(daysSupply(899, 300, '2026-01-30'), '2026-01-31');
  assert.equal(daysSupply('2 kg', '4 oz', '2024-02-28'), '2024-03-15'); // 17 days
  assert.equal(daysSupply(2, 1, '2024-02-28'), '2024-02-29');
  assert.equal(daysSupply(2, 1, '2023-02-28'), '2023-03-01');
  assert.equal(daysSupply(2, 1, '2026-12-31'), '2027-01-01');
  assert.equal(daysSupply(366, 1, '2023-12-31'), '2024-12-30');
  throwsWith(() => daysSupply(299, 300, '2026-01-30'), '299');
  throwsWith(() => daysSupply(0, 300, '2026-01-30'), '0');
  throwsWith(() => daysSupply(900, '0 g', '2026-01-30'), '0 g');
  for (const bad of ['2027-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-30', '2026-01-30T00:00', '20260130']) {
    throwsWith(() => daysSupply(900, 300, bad), bad);
  }
  throwsWith(() => daysSupply(900, 300, 20260130), '20260130');
});

test('compare: rounding, sorting, invalid last, no mutation', () => {
  const input = [
    { id: 'a', price: '€10', mass: '500 g' },
    { id: 'b', price: '$9', mass: '1 kg' },
    { id: 'c', price: 'nope', mass: '1 kg' },
    { id: 'd', price: '¥1,200', mass: '1 kg' },
    { id: 'e', price: '$29.99', mass: '400 g' },
    { id: 'f', price: '£20.0040', mass: '1 kg' },
    { id: 'g', price: '$1', mass: '0 g' },
    { id: 'h', price: '₴20.0', mass: '1 kg' },
  ];
  const snapshot = JSON.stringify(input);
  const out = compare(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.notEqual(out, input);
  assert.deepEqual(out, [
    { id: 'b', currency: 'USD', perKg: 9 },
    { id: 'a', currency: 'EUR', perKg: 20 },
    { id: 'f', currency: 'GBP', perKg: 20 },
    { id: 'h', currency: 'UAH', perKg: 20 },
    { id: 'e', currency: 'USD', perKg: 74.98 },
    { id: 'd', currency: 'JPY', perKg: 1200 },
    { id: 'c', currency: null, perKg: NaN },
    { id: 'g', currency: null, perKg: NaN },
  ]);
  assert.deepEqual(compare([]), []);
  throwsWith(() => compare('x'), 'x');
  throwsWith(() => compare(null), 'null');
});
