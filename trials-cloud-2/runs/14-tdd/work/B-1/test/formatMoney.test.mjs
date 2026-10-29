import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../src/pricing.mjs';

const NBSP = ' ';
const NNBSP = ' ';

test('formatMoney: layouts per locale with non-breaking spaces', () => {
  assert.equal(formatMoney(1234.5, 'EUR', 'de-DE'), `1.234,50${NBSP}€`);
  assert.equal(formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'en-US'), `CHF${NBSP}1,234.56`);
  assert.equal(formatMoney(1234.56, 'EUR', 'fr-FR'), `1${NNBSP}234,56${NBSP}€`);
  assert.equal(formatMoney(1234.56, 'UAH', 'uk-UA'), `1${NBSP}234,56${NBSP}₴`);
  assert.equal(formatMoney(0, 'GBP', 'en-US'), '£0.00');
  assert.equal(formatMoney(1200, 'JPY', 'en-US'), '¥1,200');
  for (const out of [formatMoney(1234567.89, 'EUR', 'fr-FR'), formatMoney(12, 'CHF', 'de-DE')]) {
    assert.ok(!out.includes(' '), `no U+0020 in ${JSON.stringify(out)}`);
  }
});

test('formatMoney: half-to-even on decimal digits, JPY has no minor units', () => {
  assert.equal(formatMoney(2.125, 'USD', 'en-US'), '$2.12');
  assert.equal(formatMoney(2.135, 'USD', 'en-US'), '$2.14');
  assert.equal(formatMoney(2.1251, 'USD', 'en-US'), '$2.13');
  assert.equal(formatMoney(0.005, 'USD', 'en-US'), '$0.00');
  assert.equal(formatMoney(0.015, 'USD', 'en-US'), '$0.02');
  assert.equal(formatMoney(9.995, 'USD', 'en-US'), '$10.00');
  assert.equal(formatMoney(2.5, 'JPY', 'en-US'), '¥2');
  assert.equal(formatMoney(3.5, 'JPY', 'en-US'), '¥4');
  assert.equal(formatMoney(1e21, 'USD', 'en-US').length > 0, true);
});

test('formatMoney: invalid arguments throw TypeError', () => {
  assert.throws(() => formatMoney(-1, 'USD', 'en-US'), (e) => e instanceof TypeError && e.message.includes('-1'));
  assert.throws(() => formatMoney(NaN, 'USD', 'en-US'), TypeError);
  assert.throws(() => formatMoney(Infinity, 'USD', 'en-US'), TypeError);
  assert.throws(() => formatMoney('1', 'USD', 'en-US'), TypeError);
  assert.throws(() => formatMoney(1, 'CAD', 'en-US'), (e) => e instanceof TypeError && e.message.includes('CAD'));
  assert.throws(() => formatMoney(1, 'USD', 'en-GB'), (e) => e instanceof TypeError && e.message.includes('en-GB'));
});
