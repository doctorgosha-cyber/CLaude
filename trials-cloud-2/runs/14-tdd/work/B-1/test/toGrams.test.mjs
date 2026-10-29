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
