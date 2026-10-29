import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSupply } from '../src/pricing.mjs';

test('daysSupply: inclusive counting with floor of whole days', () => {
  assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01');
  assert.equal(daysSupply(300, 300, '2026-01-30'), '2026-01-30');
  assert.equal(daysSupply(599, 300, '2026-01-30'), '2026-01-30');
  assert.equal(daysSupply(1000, 300, '2026-12-30'), '2027-01-01');
  assert.equal(daysSupply(3000, 100, '2024-02-01'), '2024-03-01');
  assert.equal(daysSupply(2900, 100, '2023-02-01'), '2023-03-01');
  assert.equal(daysSupply(36600, 100, '2024-01-01'), '2024-12-31');
});

test('daysSupply: accepts mass specs for bag and daily amounts', () => {
  assert.equal(daysSupply('1 kg', '4 oz', '2026-03-01'), '2026-03-08');
  assert.equal(daysSupply('2 × 500 g', 250, '2026-03-01'), '2026-03-04');
  assert.equal(daysSupply(1000, '0.5 kg', '2026-03-01'), '2026-03-02');
});

test('daysSupply: result does not depend on host time zone', () => {
  const saved = process.env.TZ;
  try {
    for (const tz of ['Pacific/Kiritimati', 'America/Anchorage', 'UTC', 'Pacific/Pago_Pago']) {
      process.env.TZ = tz;
      assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01', tz);
      assert.equal(daysSupply(300, 300, '2026-03-29'), '2026-03-29', tz);
      assert.equal(daysSupply(600, 300, '2026-10-24'), '2026-10-25', tz);
    }
  } finally {
    if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved;
  }
});

test('daysSupply: invalid inputs throw TypeError naming the input', () => {
  assert.throws(() => daysSupply(299, 300, '2026-01-30'), TypeError);
  assert.throws(() => daysSupply(0, 300, '2026-01-30'), (e) => e instanceof TypeError && e.message.includes('0'));
  assert.throws(() => daysSupply(900, -1, '2026-01-30'), (e) => e instanceof TypeError && e.message.includes('-1'));
  assert.throws(() => daysSupply(900, Infinity, '2026-01-30'), TypeError);
  assert.throws(() => daysSupply('1 banana', 300, '2026-01-30'), (e) => e instanceof TypeError && e.message.includes('1 banana'));
  for (const bad of ['2027-02-29', '2026-13-01', '2026-04-31', '2026-1-30', '2026-01-30T00:00:00Z', '26-01-30', ' 2026-01-30', '2026-00-10', '2100-02-29']) {
    assert.throws(() => daysSupply(900, 300, bad), (e) => e instanceof TypeError && e.message.includes(bad), bad);
  }
  assert.equal(daysSupply(300, 300, '2000-02-29'), '2000-02-29');
  assert.throws(() => daysSupply(900, 300, 20260130), TypeError);
});
