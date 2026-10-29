import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSupply } from '../src/pricing.mjs';

test('daysSupply: inclusive whole-day counting across month and year ends', () => {
  assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01');
  assert.equal(daysSupply(300, 300, '2026-03-15'), '2026-03-15');
  assert.equal(daysSupply(899, 300, '2026-01-30'), '2026-01-31');
  assert.equal(daysSupply(2000, 1000, '2026-12-31'), '2027-01-01');
  assert.equal(daysSupply(2000, 1000, '2028-02-28'), '2028-02-29');
  assert.equal(daysSupply(2000, 1000, '2027-02-28'), '2027-03-01');
  assert.equal(daysSupply(365 * 100, 100, '2026-01-01'), '2026-12-31');
});

test('daysSupply: accepts mass specs for either quantity', () => {
  assert.equal(daysSupply('2 lb', '4 oz', '2026-05-01'), '2026-05-08');
  assert.equal(daysSupply('1 kg', 125, '2026-05-01'), '2026-05-08');
  assert.equal(daysSupply(1000, '2 × 125 g', '2026-05-01'), '2026-05-04');
});

test('daysSupply: invalid inputs throw TypeError naming the input', () => {
  assert.throws(() => daysSupply(200, 300, '2026-01-30'), TypeError);
  for (const bad of ['2027-02-29', '2026-13-01', '2026-04-31', '2026-1-30', '2026-01-30T00:00', '2026/01/30', '', '20260130']) {
    assert.throws(() => daysSupply(900, 300, bad), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  for (const bad of [0, -5, NaN, Infinity, '0 g', null, undefined]) {
    assert.throws(() => daysSupply(bad, 300, '2026-01-30'), TypeError);
    assert.throws(() => daysSupply(900, bad, '2026-01-30'), TypeError);
  }
});
