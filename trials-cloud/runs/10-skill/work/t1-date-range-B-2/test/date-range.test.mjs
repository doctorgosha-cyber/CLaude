import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datesBetween, trackedDays, fillPriceHistory } from '../src/date-range.mjs';

test('datesBetween is inclusive of the end date (bug report: 1-30 Sep)', () => {
  const days = datesBetween('2026-09-01', '2026-09-30');
  assert.equal(days.length, 30);
  assert.equal(days[0], '2026-09-01');
  assert.equal(days.at(-1), '2026-09-30');
});

test('trackedDays counts both endpoints', () => {
  assert.equal(trackedDays('2026-09-01', '2026-09-30'), 30);
  assert.equal(trackedDays('2026-09-01', '2026-09-01'), 1);
});

test('fillPriceHistory covers the last day of the range', () => {
  const out = fillPriceHistory({ '2026-09-01': 10, '2026-09-29': 12 }, '2026-09-01', '2026-09-30');
  assert.equal(Object.keys(out).length, 30);
  assert.equal(out['2026-09-30'], 12);
  assert.equal(out['2026-09-15'], 10);
});

test('datesBetween still rejects end before start', () => {
  assert.throws(() => datesBetween('2026-09-02', '2026-09-01'), RangeError);
});

test('datesBetween crosses a month boundary correctly', () => {
  assert.deepEqual(datesBetween('2026-01-30', '2026-02-02'),
    ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02']);
});
