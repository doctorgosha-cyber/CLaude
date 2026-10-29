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
