import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, toMillilitres } from '../src/units.mjs';

const near = (a, b, tol = 0.1) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('1 lb 4 oz matches metric sheet (567 g)', () => near(toGrams('1 lb 4 oz'), 567));
test('2.2 lb is 997.90 g (metric sheet rounds to 998 g)', () => {
  near(toGrams('2.2 lb'), 2.2 * 453.59237);
  assert.equal(Math.round(toGrams('2.2 lb')), 998);
});
test('16 oz equals 1 lb', () => assert.equal(toGrams('16 oz'), toGrams('1 lb')));
test('1 oz is 28.35 g', () => assert.equal(toGrams('1oz'), 28.35));
test('metric inputs unchanged', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('250 g'), 250);
});
test('unparseable mass throws', () => assert.throws(() => toGrams('heavy'), TypeError));
test('volume still works', () => assert.equal(toMillilitres('16 fl oz'), 473.2));
