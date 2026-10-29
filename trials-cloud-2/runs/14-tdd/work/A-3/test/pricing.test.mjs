import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, pricePerKg, formatMoney, kcalPer100g, daysSupply, compare } from '../src/pricing.mjs';

const throwsWith = (fn, text) =>
  assert.throws(fn, (e) => e instanceof TypeError && e.message.length > 0 && e.message.includes(text));

test('toGrams: units, compounds, multipacks, whitespace', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('1,2 KG'), 1200);
  assert.equal(toGrams('  400g '), 400);
  assert.equal(toGrams('2 × 400 g'), 800);
  assert.equal(toGrams('3x400 g'), 1200);
  assert.equal(toGrams('400 g (2 bags)'), 800);
  assert.equal(toGrams('1 lb'), 453.59237);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
  assert.equal(toGrams('2 Pounds'), 2 * 453.59237);
  assert.equal(toGrams('12 Ounces (12 pouches)'), 12 * 12 * 28.349523125);
  assert.equal(toGrams('5 kilograms'), 5000);
  assert.equal(toGrams('2 × 400 g'), 800);
  for (const bad of ['0 g', '-1 kg', 'abc', '1 stone', '', '2 × 400 g (2 bags)', '1 kg 4 oz', '0 × 400 g']) {
    throwsWith(() => toGrams(bad), bad);
  }
  throwsWith(() => toGrams(42), '42');
  throwsWith(() => toGrams(null), 'null');
});

test('pricePerKg: markers, grouping, unit prices', () => {
  assert.deepEqual(pricePerKg('$29.99', '400 g'), { currency: 'USD', perKg: 74.975 });
  assert.deepEqual(pricePerKg('29,99 €', '1 kg'), { currency: 'EUR', perKg: 29.99 });
  assert.deepEqual(pricePerKg('1,299.00 USD', '1 kg'), { currency: 'USD', perKg: 1299 });
  assert.deepEqual(pricePerKg('eur 1.299,00', '1 kg'), { currency: 'EUR', perKg: 1299 });
  assert.deepEqual(pricePerKg('¥1,200', '1 kg'), { currency: 'JPY', perKg: 1200 });
  assert.deepEqual(pricePerKg('£1,299', '1 kg'), { currency: 'GBP', perKg: 1299 });
  assert.deepEqual(pricePerKg('12.5 ₴', '1 kg'), { currency: 'UAH', perKg: 12.5 });
  assert.deepEqual(pricePerKg('CHF 12.–', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('12.- CHF', '1 kg'), { currency: 'CHF', perKg: 12 });
  assert.deepEqual(pricePerKg('12,— €', '1 kg'), { currency: 'EUR', perKg: 12 });
  assert.deepEqual(pricePerKg('1 299,50 €', '1 kg'), { currency: 'EUR', perKg: 1299.5 });
  assert.deepEqual(pricePerKg('$10/kg', '400 g'), { currency: 'USD', perKg: 10 });
  assert.deepEqual(pricePerKg('$10 per KG', '400 g'), { currency: 'USD', perKg: 10 });
  assert.deepEqual(pricePerKg('$1 / lb', '400 g'), { currency: 'USD', perKg: 1 / 0.45359237 });
  assert.deepEqual(pricePerKg('$1 per lb', '400 g'), { currency: 'USD', perKg: 1 / 0.45359237 });
  for (const bad of ['29.99', '$29.99€', '-$5', '$-5', '$0', '$0.00', 'US$ 5', '5 CAD', '$1-', '$', 'USD']) {
    throwsWith(() => pricePerKg(bad, '1 kg'), bad);
  }
  throwsWith(() => pricePerKg('$10/kg', '0 g'), '0 g');
  throwsWith(() => pricePerKg(5, '1 kg'), '5');
});

test('formatMoney: rounding and layouts', () => {
  assert.equal(formatMoney(1234.5, 'EUR', 'de-DE'), '1.234,50 €');
  assert.equal(formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'en-US'), 'CHF 1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'de-DE'), '1.234,56 CHF');
  assert.equal(formatMoney(1234.56, 'EUR', 'fr-FR'), '1 234,56 €');
  assert.equal(formatMoney(1234.56, 'UAH', 'uk-UA'), '1 234,56 ₴');
  assert.equal(formatMoney(1234.5, 'JPY', 'en-US'), '¥1,234');
  assert.equal(formatMoney(1235.5, 'JPY', 'de-DE'), '1.236 ¥');
  assert.equal(formatMoney(2.125, 'USD', 'en-US'), '$2.12');
  assert.equal(formatMoney(2.135, 'USD', 'en-US'), '$2.14');
  assert.equal(formatMoney(2.1251, 'USD', 'en-US'), '$2.13');
  assert.equal(formatMoney(0, 'GBP', 'en-US'), '£0.00');
  assert.equal(formatMoney(999.995, 'USD', 'en-US'), '$1,000.00');
  assert.equal(formatMoney(1e21, 'USD', 'en-US'), '$1,000,000,000,000,000,000,000.00');
  assert.equal(formatMoney(1e-7, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(1234567.891, 'EUR', 'fr-FR'), '1 234 567,89 €');
  for (const [a, c, l] of [[-1, 'USD', 'en-US'], [NaN, 'USD', 'en-US'], [Infinity, 'USD', 'en-US'], ['1', 'USD', 'en-US'], [1, 'CAD', 'en-US'], [1, 'USD', 'en-GB']]) {
    throwsWith(() => formatMoney(a, c, l), '');
  }
  throwsWith(() => formatMoney(1, 'CAD', 'en-US'), 'CAD');
  throwsWith(() => formatMoney(1, 'USD', 'en-GB'), 'en-GB');
  // No U+0020 anywhere in output.
  for (const l of Object.keys({ 'en-US': 1, 'de-DE': 1, 'fr-FR': 1, 'uk-UA': 1 })) {
    for (const c of ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH']) assert.ok(!formatMoney(1234567.5, c, l).includes(' '));
  }
});

test('kcalPer100g: normalisation and range', () => {
  assert.equal(kcalPer100g('3500 kcal/kg'), 350);
  assert.equal(kcalPer100g('350 kcal/100 g'), 350);
  assert.equal(kcalPer100g('350kcal per 100g'), 350);
  assert.equal(kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);
  assert.equal(kcalPer100g('14640 kJ per kg'), 14640 / 4.184 / 10);
  assert.equal(kcalPer100g('50 KCAL / 100 G'), 50);
  assert.equal(kcalPer100g('900 kcal/100 g'), 900);
  for (const bad of ['49.9 kcal/100 g', '901 kcal/100 g', '0 kcal/kg', '350 cal/100 g', '350 kcal', '350 kcal/g', '-350 kcal/kg']) {
    throwsWith(() => kcalPer100g(bad), bad);
  }
});

test('daysSupply: inclusive counting, UTC, validation', () => {
  assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01');
  assert.equal(daysSupply(899, 300, '2026-01-30'), '2026-01-31');
  assert.equal(daysSupply(300, 300, '2026-12-31'), '2026-12-31');
  assert.equal(daysSupply('2 kg', '8 oz', '2024-02-27'), '2024-03-05'); // 8 days, leap year
  assert.equal(daysSupply('1 lb', '4 oz', '2026-01-01'), '2026-01-04');
  assert.equal(daysSupply(366, 1, '2024-01-01'), '2024-12-31');
  assert.equal(daysSupply(365, 1, '2025-01-01'), '2025-12-31');
  throwsWith(() => daysSupply(299, 300, '2026-01-30'), '299');
  throwsWith(() => daysSupply(900, 300, '2027-02-29'), '2027-02-29');
  throwsWith(() => daysSupply(900, 300, '2026-1-30'), '2026-1-30');
  throwsWith(() => daysSupply(900, 300, '2026-13-01'), '2026-13-01');
  throwsWith(() => daysSupply(900, 300, ' 2026-01-30'), '2026-01-30');
  throwsWith(() => daysSupply(0, 300, '2026-01-30'), '0');
  throwsWith(() => daysSupply(900, -1, '2026-01-30'), '-1');
  throwsWith(() => daysSupply('bad', 300, '2026-01-30'), 'bad');
  throwsWith(() => daysSupply(null, 300, '2026-01-30'), 'null');
});

test('compare: sort, rounding, invalid last, no mutation', () => {
  const input = [
    { id: 'a', price: '€10', mass: '500 g' },
    { id: 'b', price: '$9', mass: '1 kg' },
    { id: 'c', price: 'nope', mass: '1 kg' },
    { id: 'd', price: '$9.0040', mass: '1 kg' },
    { id: 'e', price: '$1', mass: '0 g' },
    { id: 'f', price: '$8.995', mass: '1 kg' },
  ];
  const snapshot = JSON.stringify(input);
  const out = compare(input);
  assert.deepEqual(out.slice(0, 4), [
    { id: 'b', currency: 'USD', perKg: 9 },
    { id: 'd', currency: 'USD', perKg: 9 },
    { id: 'f', currency: 'USD', perKg: 9 },
    { id: 'a', currency: 'EUR', perKg: 20 },
  ]);
  assert.equal(out[4].id, 'c'); assert.equal(out[4].currency, null); assert.ok(Number.isNaN(out[4].perKg));
  assert.equal(out[5].id, 'e'); assert.equal(out[5].currency, null); assert.ok(Number.isNaN(out[5].perKg));
  assert.equal(JSON.stringify(input), snapshot);
  assert.notEqual(out, input);
  assert.deepEqual(compare([]), []);
  assert.deepEqual(compare([{ id: 'j', price: '¥1,200.5', mass: '1 kg' }]), [{ id: 'j', currency: 'JPY', perKg: 1200 }]);
  throwsWith(() => compare('x'), 'x');
  throwsWith(() => compare(null), 'null');
});
