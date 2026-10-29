import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datesBetween, trackedDays, fillPriceHistory } from '../src/date-range.mjs';

test('datesBetween includes both endpoints', () => {
  const days = datesBetween('2026-09-01', '2026-09-30');
  assert.equal(days.length, 30);
  assert.equal(days[0], '2026-09-01');
  assert.equal(days.at(-1), '2026-09-30');
});

test('single-day range returns that one day', () => {
  assert.deepEqual(datesBetween('2026-09-30', '2026-09-30'), ['2026-09-30']);
});

test('range across a month boundary', () => {
  assert.deepEqual(datesBetween('2026-02-27', '2026-03-02'),
    ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
});

test('end before start throws', () => {
  assert.throws(() => datesBetween('2026-09-30', '2026-09-01'), RangeError);
});

test('trackedDays counts first and last day', () => {
  assert.equal(trackedDays('2026-09-01', '2026-09-30'), 30);
  assert.equal(trackedDays('2026-09-01', '2026-09-01'), 1);
});

test('fillPriceHistory covers the last day with the last known price', () => {
  const out = fillPriceHistory({ '2026-09-01': 10, '2026-09-15': 12 }, '2026-09-01', '2026-09-30');
  assert.equal(Object.keys(out).length, 30);
  assert.equal(out['2026-09-14'], 10);
  assert.equal(out['2026-09-30'], 12);
});
