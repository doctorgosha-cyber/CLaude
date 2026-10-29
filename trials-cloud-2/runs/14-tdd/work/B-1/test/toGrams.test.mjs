import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams } from '../src/pricing.mjs';

test('toGrams: metric units, case-insensitive, decimal comma', () => {
  assert.equal(toGrams('400 g'), 400);
  assert.equal(toGrams('400g'), 400);
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('1,5 KG'), 1500);
  assert.equal(toGrams('  2 kilograms '), 2000);
  assert.equal(toGrams('3 grams'), 3);
});

test('toGrams: imperial units and compound lb+oz', () => {
  assert.equal(toGrams('1 oz'), 28.349523125);
  assert.equal(toGrams('2 ounces'), 56.69904625);
  assert.equal(toGrams('1 lb'), 453.59237);
  assert.equal(toGrams('3 lbs'), 3 * 453.59237);
  assert.equal(toGrams('5 pounds'), 5 * 453.59237);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
});

test('toGrams: multipacks by leading count or trailing parenthetical', () => {
  assert.equal(toGrams('2 × 400 g'), 800);
  assert.equal(toGrams('2x400g'), 800);
  assert.equal(toGrams('3 X 1 kg'), 3000);
  assert.equal(toGrams('400 g (2 bags)'), 800);
  assert.equal(toGrams('100 g (12 pouches)'), 1200);
  assert.equal(toGrams('4 × 1 lb 4 oz'), 4 * (453.59237 + 4 * 28.349523125));
});

test('toGrams: invalid input throws TypeError naming the input', () => {
  for (const bad of ['0 g', '-1 kg', '400', 'abc', '', '1 kg 2 kg', '2 × 400 g (2 bags)', '0 × 400 g', '1 lb 0 oz', '1.000,5 kg']) {
    assert.throws(() => toGrams(bad), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.throws(() => toGrams(400), (e) => e instanceof TypeError && e.message.includes('400'));
  assert.throws(() => toGrams(null), TypeError);
});
