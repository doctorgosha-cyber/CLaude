import { test } from 'node:test'; import assert from 'node:assert/strict';
import { datesBetween, trackedDays, fillPriceHistory } from '../src/date-range.mjs';
test('inclusive month', () => { const d = datesBetween('2026-09-01', '2026-09-30'); assert.equal(d.length, 30); assert.equal(d.at(-1), '2026-09-30'); });
test('single day', () => assert.deepEqual(datesBetween('2026-03-05', '2026-03-05'), ['2026-03-05']));
test('year boundary', () => assert.deepEqual(datesBetween('2025-12-30', '2026-01-02'), ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']));
test('leap day', () => assert.equal(datesBetween('2028-02-27', '2028-03-01').length, 4));
test('trackedDays counts both ends', () => assert.equal(trackedDays('2026-09-01', '2026-09-30'), 30));
test('fill covers the last day', () => { const h = fillPriceHistory({ '2026-09-01': 29, '2026-09-15': 27 }, '2026-09-01', '2026-09-30'); assert.equal(h['2026-09-30'], 27); assert.equal(Object.keys(h).length, 30); });
test('end before start throws', () => assert.throws(() => datesBetween('2026-09-02', '2026-09-01'), RangeError));
