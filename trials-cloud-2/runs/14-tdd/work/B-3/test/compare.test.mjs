import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../src/pricing.mjs';

test('compare: rounds per currency, sorts ascending, invalid items last', () => {
  assert.deepEqual(
    compare([{ id: 'a', price: '€10', mass: '500 g' }, { id: 'b', price: '$9', mass: '1 kg' }]),
    [{ id: 'b', currency: 'USD', perKg: 9 }, { id: 'a', currency: 'EUR', perKg: 20 }],
  );
  const out = compare([
    { id: 'x', price: '$29.99', mass: '400 g' },      // 74.975 -> 74.98
    { id: 'bad-price', price: '29.99', mass: '400 g' },
    { id: 'y', price: '¥7499.5', mass: '100 g' },     // 74995 -> JPY 0 minor: 74996? no: 74995 exactly
    { id: 'z', price: '€8.50', mass: '1 lb 4 oz' },   // 14.99... -> 14.99
    { id: 'tie2', price: '£4.25', mass: '200 g' },    // 21.25
    { id: 'bad-mass', price: '$1', mass: '0 g' },
    { id: 'tie1', price: '£21.25', mass: '1 kg' },    // 21.25
    { id: 'jpy', price: '¥2.5', mass: '1 kg' },       // 2.5 -> 2 (half to even)
  ]);
  assert.deepEqual(out.map((p) => p.id), ['jpy', 'z', 'tie2', 'tie1', 'x', 'y', 'bad-price', 'bad-mass']);
  assert.deepEqual(out[0], { id: 'jpy', currency: 'JPY', perKg: 2 });
  assert.deepEqual(out[1], { id: 'z', currency: 'EUR', perKg: 14.99 });
  assert.deepEqual(out[2], { id: 'tie2', currency: 'GBP', perKg: 21.25 });
  assert.deepEqual(out[4], { id: 'x', currency: 'USD', perKg: 74.98 });
  assert.deepEqual(out[5], { id: 'y', currency: 'JPY', perKg: 74995 });
  assert.equal(out[6].currency, null);
  assert.ok(Number.isNaN(out[6].perKg));
  assert.equal(out[7].id, 'bad-mass');
  assert.ok(Number.isNaN(out[7].perKg));
});

test('compare: does not mutate input and rejects non-arrays', () => {
  const items = [{ id: 'a', price: '€10', mass: '500 g' }, { id: 'b', price: '$9', mass: '1 kg' }];
  const snapshot = JSON.stringify(items);
  const out = compare(items);
  assert.equal(JSON.stringify(items), snapshot);
  assert.notEqual(out, items);
  assert.ok(out.every((o, i) => o !== items[i]));
  assert.deepEqual(compare([]), []);
  for (const bad of [null, undefined, 'x', 42, { length: 0 }]) {
    assert.throws(() => compare(bad), TypeError, String(bad));
  }
  assert.deepEqual(compare([{ id: 'n' }, null]), [
    { id: 'n', currency: null, perKg: NaN },
    { id: undefined, currency: null, perKg: NaN },
  ]);
});
