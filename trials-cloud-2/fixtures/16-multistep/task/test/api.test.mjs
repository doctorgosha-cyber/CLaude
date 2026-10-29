import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortion } from '../src/api.mjs';

test('portion for a 4.2 kg adult cat on Chicken & Rice', () => {
  const res = handlePortion('species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.equal(res.status, 200);
  assert.equal(res.body.grams, 66);
  assert.equal(res.body.product.id, 'ck-chicken-dry');
});

test('rejects an unknown product', () => {
  const res = handlePortion({ species: 'dog', weight: 20, product: 'nope' });
  assert.equal(res.status, 404);
});
