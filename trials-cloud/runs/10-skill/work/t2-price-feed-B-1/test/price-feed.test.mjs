import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PriceFeed } from '../src/price-feed.mjs';

// A fetchPrice whose promises are resolved by hand, so request order and
// response order can be controlled independently.
function manualFetch() {
  const pending = [];
  const fetchPrice = (sku) => new Promise((resolve) => pending.push({ sku, resolve }));
  return { fetchPrice, pending };
}

function harness() {
  const { fetchPrice, pending } = manualFetch();
  const rendered = [];
  const feed = new PriceFeed(fetchPrice, (sku, q) => rendered.push({ sku, ...q }));
  return { feed, pending, rendered };
}

test('late answer from an earlier request does not overwrite a newer quote', async () => {
  const { feed, pending, rendered } = harness();
  const r1 = feed.refresh('A'); // scroll handler, fired at t=0
  const r2 = feed.refresh('A'); // timer, fired a moment later
  assert.equal(pending.length, 2);

  // The second request answers first with a newer quote...
  pending[1].resolve({ sku: 'A', price: 20, at: 2000 });
  await r2;
  assert.equal(feed.current('A').price, 20);

  // ...then the first request answers with an older quote.
  pending[0].resolve({ sku: 'A', price: 10, at: 1000 });
  await r1;

  assert.equal(feed.current('A').at, 2000, 'stored quote must be the newest');
  assert.equal(feed.current('A').price, 20);
  assert.equal(rendered.at(-1).at, 2000, 'last rendered quote must be the newest');
  assert.ok(rendered.every(r => r.at === 2000), 'an older quote must never be rendered after a newer one');
});

test('in-order answers still update normally', async () => {
  const { feed, pending, rendered } = harness();
  const r1 = feed.refresh('A');
  pending[0].resolve({ sku: 'A', price: 10, at: 1000 });
  await r1;
  const r2 = feed.refresh('A');
  pending[1].resolve({ sku: 'A', price: 20, at: 2000 });
  await r2;
  assert.equal(feed.current('A').price, 20);
  assert.deepEqual(rendered.map(r => r.price), [10, 20]);
});

test('refresh resolves with the quote the widget actually holds', async () => {
  const { feed, pending } = harness();
  const r1 = feed.refresh('A');
  const r2 = feed.refresh('A');
  pending[1].resolve({ sku: 'A', price: 20, at: 2000 });
  pending[0].resolve({ sku: 'A', price: 10, at: 1000 });
  const [v1, v2] = await Promise.all([r1, r2]);
  assert.equal(v2.at, 2000);
  assert.equal(v1.at, 2000, 'a superseded refresh resolves with the newer, kept quote');
});

test('SKUs are independent and refreshAll works', async () => {
  const { feed, pending } = harness();
  const all = feed.refreshAll(['A', 'B']);
  pending[1].resolve({ sku: 'B', price: 5, at: 500 });
  pending[0].resolve({ sku: 'A', price: 7, at: 9000 });
  await all;
  assert.equal(feed.current('A').price, 7);
  assert.equal(feed.current('B').price, 5);
  assert.equal(feed.current('C'), null);
});
