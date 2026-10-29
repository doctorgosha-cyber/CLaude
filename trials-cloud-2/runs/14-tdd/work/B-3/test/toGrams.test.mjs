import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams } from '../src/pricing.mjs';

test('toGrams: metric units, case-insensitive, decimal comma', () => {
  assert.equal(toGrams('400 g'), 400);
  assert.equal(toGrams('1,2 KG'), 1200);
  assert.equal(toGrams('2 kilograms'), 2000);
  assert.equal(toGrams('  750grams '), 750);
});

test('toGrams: imperial units and compound lb+oz', () => {
  assert.equal(toGrams('1 oz'), 28.349523125);
  assert.equal(toGrams('2 lbs'), 907.18474);
  assert.equal(toGrams('1 pound'), 453.59237);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
});

test('toGrams: multipacks by leading count or trailing parenthetical', () => {
  assert.equal(toGrams('2 × 400 g'), 800);
  assert.equal(toGrams('3x100g'), 300);
  assert.equal(toGrams('12 X 85 g'), 1020);
  assert.equal(toGrams('400 g (2 bags)'), 800);
  assert.equal(toGrams('85 g (12 pouches)'), 1020);
});

test('toGrams: invalid inputs throw TypeError naming the input', () => {
  for (const input of ['0 g', '-1 kg', 'abc', '5 stone', '', '1 kg 4 oz', '0 x 400 g', 'Infinity g']) {
    assert.throws(() => toGrams(input), (e) => e instanceof TypeError && e.message.includes(input), input);
  }
  assert.throws(() => toGrams(123), (e) => e instanceof TypeError && e.message.includes('123'));
  assert.throws(() => toGrams(null), TypeError);
});
