import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toGrams, toMillilitres } from '../src/units.mjs';

const close = (a, b, tol = 0.1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('imperial masses use exact avoirdupois definitions (within 0.1 g)', () => {
  close(toGrams('1 lb 4 oz'), 566.9904625);  // thermos
  close(toGrams('2.2 lb'), 997.903214);      // keyboard
  close(toGrams('1 lb'), 453.59237);
  close(toGrams('16 oz'), 453.59237);
  close(toGrams('1 oz'), 28.349523125, 0.01);
});

test('rounded to whole grams, imperial masses match the metric spec sheets', () => {
  assert.equal(Math.round(toGrams('1 lb 4 oz')), 567);
  assert.equal(Math.round(toGrams('2.2 lb')), 998);
});

test('metric masses are unchanged', () => {
  assert.equal(toGrams('1.2 kg'), 1200);
  assert.equal(toGrams('40g'), 40);
  assert.throws(() => toGrams('heavy'), TypeError);
});

test('volumes still convert', () => {
  assert.equal(toMillilitres('0.75 l'), 750);
  close(toMillilitres('16 fl oz'), 473.2);
});
