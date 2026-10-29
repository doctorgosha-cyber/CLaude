import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../src/pricing.mjs';

test('formatMoney: locale layouts with non-breaking spaces', () => {
  assert.equal(formatMoney(1234.5, 'EUR', 'de-DE'), '1.234,50 €');
  assert.equal(formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'en-US'), 'CHF 1,234.56');
  assert.equal(formatMoney(1234.56, 'EUR', 'fr-FR'), '1 234,56 €');
  assert.equal(formatMoney(1234.56, 'UAH', 'uk-UA'), '1 234,56 ₴');
  assert.equal(formatMoney(0, 'GBP', 'en-US'), '£0.00');
  assert.equal(formatMoney(5, 'CHF', 'de-DE'), '5,00 CHF');
  for (const out of [formatMoney(1234.56, 'EUR', 'fr-FR'), formatMoney(1234.56, 'CHF', 'uk-UA')]) {
    assert.equal(out.includes(' '), false);
  }
});

test('formatMoney: JPY has no minor units', () => {
  assert.equal(formatMoney(1200, 'JPY', 'en-US'), '¥1,200');
  assert.equal(formatMoney(2.5, 'JPY', 'en-US'), '¥2');
  assert.equal(formatMoney(3.5, 'JPY', 'en-US'), '¥4');
});

test('formatMoney: round half to even on decimal digits', () => {
  assert.equal(formatMoney(2.125, 'USD', 'en-US'), '$2.12');
  assert.equal(formatMoney(2.135, 'USD', 'en-US'), '$2.14');
  assert.equal(formatMoney(1.005, 'USD', 'en-US'), '$1.00');
  assert.equal(formatMoney(0.125, 'USD', 'en-US'), '$0.12');
  assert.equal(formatMoney(2.1251, 'USD', 'en-US'), '$2.13');
  assert.equal(formatMoney(999.995, 'USD', 'en-US'), '$1,000.00');
  assert.equal(formatMoney(1e21, 'USD', 'en-US').startsWith('$1,000,000,000,000,000,000,000'), true);
});

test('formatMoney: invalid inputs throw TypeError naming the input', () => {
  assert.throws(() => formatMoney(-1, 'USD', 'en-US'), (e) => e instanceof TypeError && e.message.includes('-1'));
  assert.throws(() => formatMoney(NaN, 'USD', 'en-US'), (e) => e instanceof TypeError && e.message.includes('NaN'));
  assert.throws(() => formatMoney(Infinity, 'USD', 'en-US'), TypeError);
  assert.throws(() => formatMoney('5', 'USD', 'en-US'), TypeError);
  assert.throws(() => formatMoney(5, 'CAD', 'en-US'), (e) => e instanceof TypeError && e.message.includes('CAD'));
  assert.throws(() => formatMoney(5, 'USD', 'en-GB'), (e) => e instanceof TypeError && e.message.includes('en-GB'));
});
