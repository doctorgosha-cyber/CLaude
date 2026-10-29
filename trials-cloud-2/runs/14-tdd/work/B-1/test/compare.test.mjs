import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../src/pricing.mjs';

test('compare: rounds to minor units and sorts ascending across currencies', () => {
  assert.deepEqual(
    compare([{ id: 'a', price: '€10', mass: '500 g' }, { id: 'b', price: '$9', mass: '1 kg' }]),
    [{ id: 'b', currency: 'USD', perKg: 9 }, { id: 'a', currency: 'EUR', perKg: 20 }],
  );
  // 29.99 / 0.4 = 74.975 -> half-to-even on decimal digits -> 74.98
  assert.deepEqual(compare([{ id: 'x', price: '$29.99', mass: '400 g' }]), [{ id: 'x', currency: 'USD', perKg: 74.98 }]);
  // 8.5 / 4 = 2.125 -> 2.12
  assert.deepEqual(compare([{ id: 'y', price: '$8.50', mass: '4 kg' }]), [{ id: 'y', currency: 'USD', perKg: 2.12 }]);
  // JPY rounds to whole units: 1000 / 0.3 = 3333.33 -> 3333
  assert.deepEqual(compare([{ id: 'j', price: '¥1000', mass: '300 g' }]), [{ id: 'j', currency: 'JPY', perKg: 3333 }]);
});

test('compare: equal rounded perKg keeps input order; invalid items come last in input order', () => {
  const input = [
    { id: 'p', price: '$10.004', mass: '1 kg' },
    { id: 'bad1', price: '10', mass: '1 kg' },
    { id: 'q', price: '$9.996', mass: '1 kg' },
    { id: 'bad2', price: '$10', mass: '0 g' },
    { id: 'r', price: '$5', mass: '1 kg' },
  ];
  const out = compare(input);
  assert.deepEqual(out.map((o) => o.id), ['r', 'p', 'q', 'bad1', 'bad2']);
  assert.deepEqual(out[1], { id: 'p', currency: 'USD', perKg: 10 });
  assert.deepEqual(out[2], { id: 'q', currency: 'USD', perKg: 10 });
  assert.equal(out[3].currency, null);
  assert.ok(Number.isNaN(out[3].perKg));
  assert.equal(out[4].currency, null);
  assert.ok(Number.isNaN(out[4].perKg));
});

test('compare: does not mutate input and rejects non-arrays', () => {
  const item = { id: 'a', price: '€10', mass: '500 g' };
  const input = [item, { id: 'b', price: '$9', mass: '1 kg' }];
  const snapshot = JSON.stringify(input);
  const out = compare(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(input[0], item);
  assert.notEqual(out, input);
  assert.deepEqual(compare([]), []);
  assert.deepEqual(compare([{ id: 'z', price: 7, mass: null }]), [{ id: 'z', currency: null, perKg: NaN }]);
  assert.deepEqual(compare([null]), [{ id: undefined, currency: null, perKg: NaN }]);
  for (const bad of ['[]', null, undefined, 42, {}]) {
    assert.throws(() => compare(bad), TypeError);
  }
});
