import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCatalogue, findProduct } from '../src/catalogue.mjs';

test('catalogue loads all products and converts per-kg energy', () => {
  const products = loadCatalogue();
  assert.equal(products.length, 14);
  const kitten = findProduct(products, 'ck-kitten-growth');
  assert.equal(kitten.kcalPer100g, 408);
  const chicken = findProduct(products, 'ck-chicken-dry');
  assert.equal(chicken.kcalPer100g, 372);
  assert.equal(chicken.form, 'dry');
});
