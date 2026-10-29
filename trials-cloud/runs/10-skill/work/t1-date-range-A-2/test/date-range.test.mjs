import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datesBetween, trackedDays, fillPriceHistory } from '../src/date-range.mjs';

test('datesBetween includes both endpoints', () => {
  const days = datesBetween('2026-09-01', '2026-09-30');
  assert.equal(days.length, 30);
  assert.equal(days[0], '2026-09-01');
  assert.equal(days.at(-1), '2026-09-30');
});

test('single-day range yields one date', () => {
  assert.deepEqual(datesBetween('2026-09-30', '2026-09-30'), ['2026-09-30']);
});

test('crosses month and year boundaries', () => {
  assert.deepEqual(datesBetween('2026-12-30', '2027-01-02'),
    ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
});

test('end before start throws', () => {
  assert.throws(() => datesBetween('2026-09-02', '2026-09-01'), RangeError);
});

test('trackedDays counts both ends', () => {
  assert.equal(trackedDays('2026-09-01', '2026-09-30'), 30);
});

test('fillPriceHistory covers the last day', () => {
  const out = fillPriceHistory({ '2026-09-01': 10, '2026-09-29': 12 }, '2026-09-01', '2026-09-30');
  assert.equal(Object.keys(out).length, 30);
  assert.equal(out['2026-09-28'], 10);
  assert.equal(out['2026-09-30'], 12);
});
