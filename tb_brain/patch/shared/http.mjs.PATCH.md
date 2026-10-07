# Patch note: `shared/http.mjs` (file not included in the TB-BRAIN package, so the route is described, not applied)

`office/server.mjs` now passes `signals: signalsReader(root)` into `createServer(...)` (next to `market`).
Add one GET route to the request dispatcher in `shared/http.mjs`, right beside the `/api/market` route:

```js
// TB-BRAIN: signals & market state, read-only (projects/trading-bot/out/signals.json)
if (req.method === 'GET' && url.pathname === '/api/signals' && opts.signals) {
  const [status, body] = opts.signals.read();
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  return res.end(JSON.stringify(body));
}
```

* Same PIN gate / LAN rules as every other `/api/*` route (place it after the gate).
* No write route, no POST: the trading room only reads.
* Suggested shared test (`shared/test/signals.test.mjs`): 404 when the file is absent; 200 + `disclaimer` when present; 500 on bad JSON.
