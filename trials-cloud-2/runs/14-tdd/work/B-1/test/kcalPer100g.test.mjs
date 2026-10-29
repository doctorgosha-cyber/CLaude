import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kcalPer100g } from '../src/pricing.mjs';

test('kcalPer100g: normalises kcal/kJ per 100 g or per kg', () => {
  assert.equal(kcalPer100g('350 kcal/100 g'), 350);
  assert.equal(kcalPer100g('3500 kcal/kg'), 350);
  assert.equal(kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);
  assert.equal(kcalPer100g('14640 kJ per kg'), 14640 / 4.184 / 10);
  assert.equal(kcalPer100g('  350KCAL per 100g '), 350);
  assert.equal(kcalPer100g('350,5 kcal / 100 g'), 350.5);
  assert.equal(kcalPer100g('50 kcal/100 g'), 50);
  assert.equal(kcalPer100g('900 kcal/100 g'), 900);
});

test('kcalPer100g: out-of-range or malformed specs throw TypeError', () => {
  for (const bad of ['49.9 kcal/100 g', '901 kcal/100 g', '350 kcal', '350 kcal/10 g', '350 cal/100 g', '0 kcal/100 g', '-350 kcal/100 g', '', '3500 kJ/100 g (approx)']) {
    assert.throws(() => kcalPer100g(bad), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.throws(() => kcalPer100g(350), TypeError);
});
