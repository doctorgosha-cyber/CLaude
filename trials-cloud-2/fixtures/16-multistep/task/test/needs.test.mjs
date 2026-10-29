import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyKcal, restingEnergy } from '../src/needs.mjs';

test('resting energy follows 70 * kg^0.75', () => {
  assert.ok(Math.abs(restingEnergy(4) - 198.0) < 0.1);
});

test('adult cat at 4 kg, normal activity', () => {
  const kcal = dailyKcal({ species: 'cat', weightKg: 4, stage: 'adult', activity: 'normal' });
  assert.ok(Math.abs(kcal - 237.6) < 0.1, `got ${kcal}`);
});
