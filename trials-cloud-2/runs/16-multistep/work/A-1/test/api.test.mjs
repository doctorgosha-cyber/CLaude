import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortion } from '../src/api.mjs';

test('portion for a 4.2 kg adult cat on Chicken & Rice is plausible; unknown product is a 404', () => {
  const res = handlePortion('species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.equal(res.status, 200);
  assert.ok(res.body.grams > 50 && res.body.grams < 85, `grams ${res.body.grams}`);
  assert.equal(res.body.product.id, 'ck-chicken-dry');
  assert.equal(handlePortion({ species: 'dog', weight: 20, product: 'nope' }).status, 404);
});
