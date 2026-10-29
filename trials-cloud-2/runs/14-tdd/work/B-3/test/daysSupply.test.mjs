import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysSupply } from '../src/pricing.mjs';

test('daysSupply: inclusive whole days, calendar arithmetic independent of TZ', () => {
  const savedTZ = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/New_York', 'Asia/Kolkata']) {
      process.env.TZ = tz;
      assert.equal(daysSupply(900, 300, '2026-01-30'), '2026-02-01', tz);
      assert.equal(daysSupply(1000, 300, '2026-01-30'), '2026-02-01', tz); // partial day dropped
      assert.equal(daysSupply(300, 300, '2026-12-31'), '2026-12-31', tz); // one day
      assert.equal(daysSupply(600, 300, '2026-12-31'), '2027-01-01', tz); // year boundary
      assert.equal(daysSupply(60, 1, '2024-02-27'), '2024-04-26', tz); // leap day counted
      assert.equal(daysSupply(60, 1, '2023-02-27'), '2023-04-27', tz);
      assert.equal(daysSupply('2 lb', '4 oz', '2026-03-01'), '2026-03-08', tz); // 8 whole days
      assert.equal(daysSupply('1.5 kg', 150, '2026-10-25'), '2026-11-03', tz);
    }
  } finally {
    if (savedTZ === undefined) delete process.env.TZ; else process.env.TZ = savedTZ;
  }
});

test('daysSupply: invalid masses and dates throw TypeError naming the input', () => {
  for (const [bag, daily, start] of [[200, 300, '2026-01-01'], [0, 1, '2026-01-01'], [100, -1, '2026-01-01'], ['abc', 1, '2026-01-01'], [NaN, 1, '2026-01-01']]) {
    assert.throws(() => daysSupply(bag, daily, start), TypeError, `${bag} ${daily}`);
  }
  for (const start of ['2027-02-29', '2026-13-01', '2026-04-31', '2026-1-05', '2026-01-05T00:00', ' 2026-01-05', '20260105', '2026/01/05', '']) {
    assert.throws(() => daysSupply(900, 300, start), (e) => e instanceof TypeError && e.message.includes(start), start);
  }
  assert.equal(daysSupply(900, 300, '2028-02-29'), '2028-03-02');
  assert.equal(daysSupply(300, 300, '2000-02-29'), '2000-02-29');
  assert.throws(() => daysSupply(300, 300, '1900-02-29'), TypeError);
});
