import { test } from 'node:test'; import assert from 'node:assert/strict';
import { PriceFeed } from '../src/price-feed.mjs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function slowThenFast() { let n = 0; return async sku => { n++; const at = n; const delay = n === 1 ? 40 : 5; await sleep(delay); return { sku, price: 100 + n, at }; }; }
test('later request answered earlier wins (render)', async () => {
  const rendered = []; const feed = new PriceFeed(slowThenFast(), (sku, r) => rendered.push(r.at));
  await Promise.all([feed.refresh('A'), feed.refresh('A')]);
  assert.equal(rendered.at(-1), 2, 'last render must be the newest quote');
  assert.equal(feed.current('A').at, 2);
});
test('stale quote is never stored', async () => {
  const feed = new PriceFeed(slowThenFast(), () => {});
  const p1 = feed.refresh('A'); await sleep(1); const p2 = feed.refresh('A'); await Promise.all([p1, p2]);
  assert.equal(feed.current('A').at, 2);
});
test('different SKUs do not interfere', async () => {
  let n = 0; const feed = new PriceFeed(async sku => { n++; await sleep(sku === 'A' ? 30 : 5); return { sku, price: n, at: n }; }, () => {});
  await feed.refreshAll(['A', 'B']);
  assert.equal(feed.current('A').sku, 'A'); assert.equal(feed.current('B').sku, 'B');
});
test('sequential refreshes keep working', async () => {
  let n = 0; const feed = new PriceFeed(async sku => ({ sku, price: ++n, at: n }), () => {});
  await feed.refresh('A'); await feed.refresh('A'); assert.equal(feed.current('A').at, 2);
});
test('render is not called for a stale quote', async () => {
  const rendered = []; const feed = new PriceFeed(slowThenFast(), (sku, r) => rendered.push(r.at));
  await Promise.all([feed.refresh('A'), feed.refresh('A')]);
  assert.deepEqual(rendered, [2]);
});
