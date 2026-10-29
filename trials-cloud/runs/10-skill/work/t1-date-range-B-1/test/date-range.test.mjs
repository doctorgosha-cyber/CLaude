import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datesBetween, trackedDays, fillPriceHistory } from '../src/date-range.mjs';

test('datesBetween is inclusive of the end date (1-30 Sept has 30 days, ends on the 30th)', () => {
  const days = datesBetween('2026-09-01', '2026-09-30');
  assert.equal(days.length, 30);
  assert.equal(days[0], '2026-09-01');
  assert.equal(days.at(-1), '2026-09-30');
});

test('datesBetween with start === end yields that single day', () => {
  assert.deepEqual(datesBetween('2026-09-30', '2026-09-30'), ['2026-09-30']);
});

test('datesBetween crosses a month boundary inclusively', () => {
  assert.deepEqual(datesBetween('2026-09-29', '2026-10-01'), ['2026-09-29', '2026-09-30', '2026-10-01']);
});

test('datesBetween throws when end is before start', () => {
  assert.throws(() => datesBetween('2026-09-02', '2026-09-01'), RangeError);
});

test('trackedDays counts both the first and last sample', () => {
  assert.equal(trackedDays('2026-09-01', '2026-09-30'), 30);
  assert.equal(trackedDays('2026-09-01', '2026-09-01'), 1);
});

test('fillPriceHistory covers the last day of the range', () => {
  const out = fillPriceHistory({ '2026-09-01': 10, '2026-09-15': 12 }, '2026-09-01', '2026-09-30');
  assert.equal(Object.keys(out).length, 30);
  assert.equal(out['2026-09-30'], 12);
  assert.equal(out['2026-09-14'], 10);
});
