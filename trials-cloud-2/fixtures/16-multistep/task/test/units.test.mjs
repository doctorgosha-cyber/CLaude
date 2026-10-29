import test from 'node:test';
import assert from 'node:assert/strict';
import { kcalPerKgTo100g, parseNumber } from '../src/units.mjs';

test('energy per kg converts to per 100 g', () => {
  assert.equal(kcalPerKgTo100g(3920), 392);
  assert.equal(kcalPerKgTo100g(4080), 408);
});

test('parseNumber rejects junk', () => {
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('')));
  assert.equal(parseNumber('4.2'), 4.2);
});
