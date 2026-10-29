import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, toMillilitres, cToF, fToC } from '../src/units.mjs';

// International avoirdupois: 1 lb = 453.59237 g exactly, 1 oz = 1/16 lb.
const LB = 453.59237;
const OZ = LB / 16;

function assertWithin(actual, expected, tol, label) {
  assert.ok(Math.abs(actual - expected) <= tol,
    `${label}: got ${actual}, expected ${expected} (±${tol})`);
}

test('bug report: "1 lb 4 oz" thermos matches metric sheet 567 g within 0.1 g', () => {
  assertWithin(toGrams('1 lb 4 oz'), 567, 0.1, '1 lb 4 oz');
});

test('bug report: "2.2 lb" keyboard matches metric sheet ~998 g within 0.1 g', () => {
  assertWithin(toGrams('2.2 lb'), 2.2 * LB, 0.1, '2.2 lb'); // 997.90 g
});

test('single ounce and pound use exact avoirdupois factors', () => {
  assertWithin(toGrams('1 oz'), OZ, 0.01, '1 oz');   // 28.35 g
  assertWithin(toGrams('1 lb'), LB, 0.01, '1 lb');   // 453.59 g
  assertWithin(toGrams('16 oz'), LB, 0.01, '16 oz');
});

test('metric masses are unchanged', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('40g'), 40);
  assert.throws(() => toGrams('heavy'), TypeError);
});

test('volume and temperature helpers are unaffected', () => {
  assert.equal(toMillilitres('16 fl oz'), 473.2);
  assert.equal(toMillilitres('0.75 l'), 750);
  assert.equal(cToF(100), 212);
  assert.equal(fToC(32), 0);
});
