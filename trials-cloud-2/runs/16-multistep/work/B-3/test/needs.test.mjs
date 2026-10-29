import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyKcal, restingEnergy, resolveStage, isGrowthStage } from '../src/needs.mjs';

test('energy need: RER is 70 * kg^0.75 and an adult cat at 4 kg needs 237.6 kcal', () => {
  assert.ok(Math.abs(restingEnergy(4) - 198.0) < 0.1);
  const kcal = dailyKcal({ species: 'cat', weightKg: 4, stage: 'adult', activity: 'normal' });
  assert.ok(Math.abs(kcal - 237.6) < 0.1, `got ${kcal}`);
});

test('legacy stage aliases resolve to the current key; unknown stages are rejected, never guessed', () => {
  assert.equal(resolveStage('cat', 'neutered_adult'), 'neutered');
  assert.equal(resolveStage('cat', 'growth'), 'kitten');
  assert.equal(resolveStage('dog', 'puppy_growth'), 'puppy');
  assert.equal(resolveStage('cat', 'puppy'), undefined);
  assert.equal(resolveStage('cat', 'toString'), undefined);
  assert.equal(resolveStage('cat', 'teen'), undefined);
  const neutered = dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered_adult' });
  assert.ok(Math.abs(neutered - 198.0) < 0.1, `alias must use the neutered factor, got ${neutered}`);
  assert.throws(() => dailyKcal({ species: 'cat', weightKg: 4, stage: 'teen' }), RangeError);
  assert.ok(isGrowthStage('cat', 'kitten') && isGrowthStage('cat', 'growth') && isGrowthStage('dog', 'puppy_growth'));
  assert.ok(!isGrowthStage('cat', 'adult') && !isGrowthStage('dog', 'senior'));
});
