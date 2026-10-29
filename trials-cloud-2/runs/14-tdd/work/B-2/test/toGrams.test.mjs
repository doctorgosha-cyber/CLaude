import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams } from '../src/pricing.mjs';

test('toGrams: plain gram and kilogram units', () => {
  assert.equal(toGrams('400 g'), 400);
  assert.equal(toGrams('1.2 kg'), 1200);
});
