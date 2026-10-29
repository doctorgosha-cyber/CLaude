import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PriceFeed } from '../src/price-feed.mjs';

function deferred() {
  let resolve; const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test('a late-arriving older quote does not overwrite a newer one', async () => {
  const pending = [];
  const rendered = [];
  const feed = new PriceFeed(
    sku => { const d = deferred(); pending.push(d); return d.promise; },
    (sku, q) => rendered.push(q.price),
  );

  const r1 = feed.refresh('A'); // first request (older quote, answers last)
  const r2 = feed.refresh('A'); // second request (newer quote, answers first)
  pending[1].resolve({ sku: 'A', price: 20, at: 2000 });
  pending[0].resolve({ sku: 'A', price: 10, at: 1000 });
  const [q1, q2] = await Promise.all([r1, r2]);

  assert.equal(feed.current('A').price, 20);
  assert.equal(feed.current('A').at, 2000);
  assert.deepEqual(rendered, [20]);          // the stale quote was never rendered
  assert.equal(q1.price, 20);                // resolves with the quote actually held
  assert.equal(q2.price, 20);
});

test('in-order quotes update normally and SKUs are independent', async () => {
  const rendered = [];
  let t = 0;
  const feed = new PriceFeed(
    async sku => ({ sku, price: ++t, at: t * 100 }),
    (sku, q) => rendered.push([sku, q.price]),
  );
  await feed.refresh('A');
  await feed.refresh('A');
  await feed.refreshAll(['B', 'A']);
  assert.equal(feed.current('A').price, 4);
  assert.equal(feed.current('B').price, 3);
  assert.equal(feed.current('C'), null);
  assert.deepEqual(rendered, [['A', 1], ['A', 2], ['B', 3], ['A', 4]]);
});
