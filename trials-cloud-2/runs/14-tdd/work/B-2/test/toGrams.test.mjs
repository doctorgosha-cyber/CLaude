import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams } from '../src/pricing.mjs';

test('toGrams: plain gram and kilogram units', () => {
  assert.equal(toGrams('400 g'), 400);
  assert.equal(toGrams('1.2 kg'), 1200);
});

test('toGrams: imperial units and compound lb+oz', () => {
  assert.equal(toGrams('1 oz'), 28.349523125);
  assert.equal(toGrams('2 LBS'), 907.18474);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
  assert.equal(toGrams('3 pounds'), 3 * 453.59237);
});

test('toGrams: multipacks, Unicode spaces, decimal comma', () => {
  assert.equal(toGrams('2 × 400 g'), 800);
  assert.equal(toGrams('3x100g'), 300);
  assert.equal(toGrams('12 X 85 g'), 1020);
  assert.equal(toGrams('400 g (2 bags)'), 800);
  assert.equal(toGrams('85g (12 pouches)'), 1020);
  assert.equal(toGrams('  1,5 kg '), 1500);
  assert.equal(toGrams('1 lb 4 oz'), 453.59237 + 4 * 28.349523125);
});

test('toGrams: invalid inputs throw TypeError naming the input', () => {
  for (const bad of ['0 g', '-1 kg', '1 stone', 'abc', '', '2 × 400 g (2 bags)', '1 lb 4 kg', '0 × 400 g', '400 g (0 bags)']) {
    assert.throws(() => toGrams(bad), (e) => e instanceof TypeError && e.message.includes(bad));
  }
  assert.throws(() => toGrams(400), (e) => e instanceof TypeError && e.message.includes('400'));
  assert.throws(() => toGrams(null), TypeError);
});
