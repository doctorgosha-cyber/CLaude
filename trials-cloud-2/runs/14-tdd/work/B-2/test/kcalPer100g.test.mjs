import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kcalPer100g } from '../src/pricing.mjs';

test('kcalPer100g: normalises kcal/kJ per 100 g or per kg', () => {
  assert.equal(kcalPer100g('3500 kcal/kg'), 350);
  assert.equal(kcalPer100g('350 kcal/100 g'), 350);
  assert.equal(kcalPer100g('350kcal/100g'), 350);
  assert.equal(kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);
  assert.equal(kcalPer100g('14640 kJ per kg'), 14640 / 4.184 / 10);
  assert.equal(kcalPer100g(' 3.750 KCAL PER KG '), 375);
  assert.equal(kcalPer100g('382,5 kcal / 100 g'), 382.5);
});

test('kcalPer100g: sanity range applies to the normalised value', () => {
  assert.equal(kcalPer100g('500 kcal/kg'), 50);
  assert.equal(kcalPer100g('900 kcal/100 g'), 900);
  for (const bad of ['499 kcal/kg', '901 kcal/100 g', '49.9 kcal/100 g', '0 kcal/100 g', '-350 kcal/100 g', '350 kcal/lb', '350 cal/100 g', '350 kcal', '', 'abc']) {
    assert.throws(() => kcalPer100g(bad), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.throws(() => kcalPer100g(350), (e) => e instanceof TypeError && e.message.includes('350'));
});
