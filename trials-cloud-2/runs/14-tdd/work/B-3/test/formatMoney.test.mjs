import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../src/pricing.mjs';

test('formatMoney: locale layouts with non-breaking spaces', () => {
  assert.equal(formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(1234.56, 'CHF', 'en-US'), 'CHF 1,234.56');
  assert.equal(formatMoney(1234.5, 'EUR', 'de-DE'), '1.234,50 €');
  assert.equal(formatMoney(1234.56, 'EUR', 'fr-FR'), '1 234,56 €');
  assert.equal(formatMoney(1234.56, 'UAH', 'uk-UA'), '1 234,56 ₴');
  assert.equal(formatMoney(1200, 'JPY', 'en-US'), '¥1,200');
  assert.equal(formatMoney(0, 'GBP', 'en-US'), '£0.00');
  for (const out of [formatMoney(1234567.89, 'EUR', 'fr-FR'), formatMoney(1234567.89, 'CHF', 'uk-UA')]) {
    assert.ok(!out.includes(' '), `no U+0020 in ${JSON.stringify(out)}`);
  }
});

test('formatMoney: round half to even on the decimal digits of String(amount)', () => {
  assert.equal(formatMoney(2.125, 'USD', 'en-US'), '$2.12');
  assert.equal(formatMoney(2.135, 'USD', 'en-US'), '$2.14');
  assert.equal(formatMoney(1.005, 'USD', 'en-US'), '$1.00');
  assert.equal(formatMoney(2.675, 'USD', 'en-US'), '$2.68');
  assert.equal(formatMoney(2.1250001, 'USD', 'en-US'), '$2.13');
  assert.equal(formatMoney(9.995, 'EUR', 'de-DE'), '10,00 €');
  assert.equal(formatMoney(0.125, 'GBP', 'en-US'), '£0.12');
  assert.equal(formatMoney(2.5, 'JPY', 'en-US'), '¥2');
  assert.equal(formatMoney(3.5, 'JPY', 'en-US'), '¥4');
  assert.equal(formatMoney(1234.5, 'JPY', 'en-US'), '¥1,234');
  for (const [a, c, l] of [[-1, 'USD', 'en-US'], [NaN, 'USD', 'en-US'], [Infinity, 'USD', 'en-US'], ['5', 'USD', 'en-US'], [5, 'CAD', 'en-US'], [5, 'USD', 'en-GB']]) {
    assert.throws(() => formatMoney(a, c, l), TypeError, `${a} ${c} ${l}`);
  }
});
