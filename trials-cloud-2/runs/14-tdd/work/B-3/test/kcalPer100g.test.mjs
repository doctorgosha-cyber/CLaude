import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kcalPer100g } from '../src/pricing.mjs';

test('kcalPer100g: kcal and kJ per 100 g or per kg normalise to kcal/100 g', () => {
  assert.equal(kcalPer100g('350 kcal/100 g'), 350);
  assert.equal(kcalPer100g('3500 kcal/kg'), 350);
  assert.equal(kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);
  assert.equal(kcalPer100g('14640 kJ per kg'), 1464 / 4.184);
  assert.equal(kcalPer100g('  372,5 KCAL per 100g '), 372.5);
  assert.equal(kcalPer100g('3725 kcal / kg'), 372.5);
  for (const bad of ['49.9 kcal/100 g', '900.1 kcal/100 g', '350 kcal', '350 cal/100 g', '350 kcal/10 g', '0 kcal/kg', '-350 kcal/100 g', '']) {
    assert.throws(() => kcalPer100g(bad), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.throws(() => kcalPer100g(350), TypeError);
  assert.equal(kcalPer100g('50 kcal/100 g'), 50);
  assert.equal(kcalPer100g('9000 kcal/kg'), 900);
});
