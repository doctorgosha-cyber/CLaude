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
