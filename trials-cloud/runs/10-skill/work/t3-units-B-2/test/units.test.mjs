import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, toMillilitres } from '../src/units.mjs';

const near = (actual, expected, tol = 0.1) =>
  assert.ok(Math.abs(actual - expected) <= tol + 1e-9, `expected ${actual} within ${tol} of ${expected}`);

test('toGrams matches metric spec sheets (international avoirdupois)', () => {
  near(toGrams('1 lb 4 oz'), 567);   // thermos: reader reported 565 g
  near(toGrams('2.2 lb'), 998);      // keyboard: reader reported 996.6 g
  assert.equal(toGrams('1 lb 4 oz'), 566.99);
  assert.equal(toGrams('2.2 lb'), 997.9);
  assert.equal(toGrams('1 lb'), 453.59);
  assert.equal(toGrams('1 oz'), 28.35);
  assert.equal(toGrams('16 oz'), toGrams('1 lb'));
});

test('toGrams metric inputs unchanged', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('40g'), 40);
  assert.throws(() => toGrams('heavy'), TypeError);
});

test('toMillilitres still works', () => {
  assert.equal(toMillilitres('16 fl oz'), 473.2);
  assert.equal(toMillilitres('0.75 l'), 750);
});
