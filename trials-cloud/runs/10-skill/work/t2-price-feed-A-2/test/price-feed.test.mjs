import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PriceFeed } from '../src/price-feed.mjs';

// Builds a fetchPrice whose n-th call resolves with quotes[n] when resolve[n]() is called.
function deferredFetch(quotes) {
  const resolvers = [];
  const fetchPrice = () => new Promise(res => resolvers.push(res));
  return { fetchPrice, resolve: i => resolvers[i](quotes[i]) };
}

test('out-of-order response: older quote does not overwrite a newer one', async () => {
  const quotes = [{ sku: 'A', price: 10, at: 1000 }, { sku: 'A', price: 12, at: 2000 }];
  const { fetchPrice, resolve } = deferredFetch(quotes);
  const rendered = [];
  const feed = new PriceFeed(fetchPrice, (sku, q) => rendered.push(q));

  const first = feed.refresh('A');   // fired first, answers last
  const second = feed.refresh('A');  // fired second, answers first with the newer quote
  resolve(1);
  await second;
  resolve(0);
  await first;

  assert.equal(feed.current('A').price, 12);
  assert.deepEqual(rendered.map(q => q.price), [12]);
  assert.equal(await first, feed.current('A'));
});

test('in-order responses still update normally', async () => {
  const quotes = [{ sku: 'A', price: 10, at: 1000 }, { sku: 'A', price: 12, at: 2000 }];
  const { fetchPrice, resolve } = deferredFetch(quotes);
  const rendered = [];
  const feed = new PriceFeed(fetchPrice, (sku, q) => rendered.push(q));
  const p1 = feed.refresh('A'); resolve(0); await p1;
  const p2 = feed.refresh('A'); resolve(1); await p2;
  assert.equal(feed.current('A').price, 12);
  assert.deepEqual(rendered.map(q => q.price), [10, 12]);
});

test('refreshAll keeps SKUs independent', async () => {
  const feed = new PriceFeed(async sku => ({ sku, price: sku.length, at: 1 }), () => {});
  await feed.refreshAll(['A', 'BB']);
  assert.equal(feed.current('A').price, 1);
  assert.equal(feed.current('BB').price, 2);
  assert.equal(feed.current('ZZZ'), null);
});
