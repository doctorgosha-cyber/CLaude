import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PriceFeed } from '../src/price-feed.mjs';

// Builds a fetchPrice whose responses are resolved by hand, so request order
// and response order can be made to differ deterministically.
function controlledFetch() {
  const pending = [];
  const fetchPrice = sku => new Promise(resolve => pending.push({ sku, resolve }));
  return { fetchPrice, pending };
}

test('a late reply carrying an older quote must not overwrite a newer one (render + current)', async () => {
  const { fetchPrice, pending } = controlledFetch();
  const renders = [];
  const feed = new PriceFeed(fetchPrice, (sku, q) => renders.push({ sku, q }));

  const first = feed.refresh('A');   // scroll handler
  const second = feed.refresh('A');  // timer, fired later
  assert.equal(pending.length, 2);

  // The second request answers first, with the newer quote...
  pending[1].resolve({ sku: 'A', price: 20, at: 2000 });
  await second;
  // ...then the first request answers with the older quote.
  pending[0].resolve({ sku: 'A', price: 10, at: 1000 });
  await first;

  assert.equal(feed.current('A').at, 2000, 'current() must keep the newest quote');
  assert.equal(feed.current('A').price, 20);
  const last = renders.at(-1);
  assert.equal(last.q.at, 2000, 'last render must be the newest quote');
});

test('a later request that returns a newer quote still updates normally', async () => {
  const { fetchPrice, pending } = controlledFetch();
  const renders = [];
  const feed = new PriceFeed(fetchPrice, (sku, q) => renders.push(q));
  const p1 = feed.refresh('A');
  pending[0].resolve({ sku: 'A', price: 10, at: 1000 });
  await p1;
  const p2 = feed.refresh('A');
  pending[1].resolve({ sku: 'A', price: 11, at: 1500 });
  await p2;
  assert.equal(feed.current('A').at, 1500);
  assert.deepEqual(renders.map(q => q.at), [1000, 1500]);
});

test('stale quotes for one SKU do not affect another SKU (refreshAll)', async () => {
  const { fetchPrice, pending } = controlledFetch();
  const renders = [];
  const feed = new PriceFeed(fetchPrice, (sku, q) => renders.push({ sku, at: q.at }));
  const all = feed.refreshAll(['A', 'B']);
  pending[0].resolve({ sku: 'A', price: 1, at: 100 });
  pending[1].resolve({ sku: 'B', price: 2, at: 200 });
  await all;
  const late = feed.refresh('B');
  pending[2].resolve({ sku: 'B', price: 0, at: 50 }); // older than what we have for B
  await late;
  assert.equal(feed.current('A').at, 100);
  assert.equal(feed.current('B').at, 200);
  assert.deepEqual(renders.filter(r => r.sku === 'B').map(r => r.at), [200]);
});
