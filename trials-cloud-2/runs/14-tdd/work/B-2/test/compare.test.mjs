import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../src/pricing.mjs';

test('compare: sorts by rounded perKg ascending regardless of currency', () => {
  assert.deepEqual(
    compare([{ id: 'a', price: '€10', mass: '500 g' }, { id: 'b', price: '$9', mass: '1 kg' }]),
    [{ id: 'b', currency: 'USD', perKg: 9 }, { id: 'a', currency: 'EUR', perKg: 20 }],
  );
});

test('compare: rounds with the formatMoney rule before sorting; ties keep input order', () => {
  const out = compare([
    { id: 'x', price: '$29.99', mass: '400 g' },   // 74.975 -> 74.98
    { id: 'y', price: '$149.95', mass: '2 kg' },   // 74.975 -> 74.98 (tie, stays after x)
    { id: 'z', price: '¥74.5', mass: '1 kg' },     // JPY: 74.5 -> 74
    { id: 'w', price: '$8.5', mass: '4 kg' },      // 2.125 -> 2.12 (half to even)
    { id: 'v', price: '$8.54', mass: '4 kg' },     // 2.135 -> 2.14 (half to even)
  ]);
  assert.deepEqual(out, [
    { id: 'w', currency: 'USD', perKg: 2.12 },
    { id: 'v', currency: 'USD', perKg: 2.14 },
    { id: 'z', currency: 'JPY', perKg: 74 },
    { id: 'x', currency: 'USD', perKg: 74.98 },
    { id: 'y', currency: 'USD', perKg: 74.98 },
  ]);
});

test('compare: invalid rows come last in input order as { currency: null, perKg: NaN }', () => {
  const out = compare([
    { id: 'bad1', price: '29.99', mass: '400 g' },
    { id: 'ok', price: '$5', mass: '1 kg' },
    { id: 'bad2', price: '$5', mass: '0 g' },
    { id: 'bad3' },
  ]);
  assert.equal(out.length, 4);
  assert.deepEqual(out[0], { id: 'ok', currency: 'USD', perKg: 5 });
  assert.equal(out[1].id, 'bad1');
  assert.equal(out[2].id, 'bad2');
  assert.equal(out[3].id, 'bad3');
  for (const row of out.slice(1)) {
    assert.equal(row.currency, null);
    assert.ok(Number.isNaN(row.perKg));
  }
});

test('compare: does not mutate input, returns a new array; non-array throws', () => {
  const items = [{ id: 'a', price: '€10', mass: '500 g' }, { id: 'b', price: '$9', mass: '1 kg' }];
  const snapshot = JSON.stringify(items);
  const out = compare(items);
  assert.notEqual(out, items);
  assert.equal(JSON.stringify(items), snapshot);
  assert.equal(items[0].id, 'a');
  assert.deepEqual(compare([]), []);
  for (const bad of [null, undefined, 'abc', 5, { length: 1 }]) {
    assert.throws(() => compare(bad), TypeError);
  }
});
