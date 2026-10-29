# Bug report: price widget sometimes shows yesterday's price after a refresh

Module: `src/price-feed.mjs` (ES module, Node 22, no dependencies). `fetchPrice(sku)` is injected and returns `{ sku, price, at }` where `at` is the server timestamp of the quote (ms). The network is slow and uneven: a request fired later can answer earlier.

Symptom from the field log: a card is refreshed twice within a second (scroll handler + timer). The widget ends up showing the price from the FIRST request although the SECOND request returned a newer quote. Reloading the page fixes it, which is how the editor noticed.

Please fix it so the widget never ends up showing or storing a quote that is older than one it already has for that SKU. Keep the public API (`refresh`, `refreshAll`, `current`). You may add tests. Do not touch files outside this folder.
