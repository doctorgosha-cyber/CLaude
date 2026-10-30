# PERF.md — what changed and why

Measured with the release-check command from the README (Lighthouse CLI, mobile preset,
simulated throttling, headless Chromium) against `node serve.mjs` (plain static files,
no compression). Each step was re-measured with the same command.

## Before → after

| Metric | Before | After (3 runs) |
|---|---|---|
| Performance score (mobile) | 16 | 100 / 100 / 100 |
| First Contentful Paint | 18.8 s | 0.8 s |
| Largest Contentful Paint | 49.6 s | 1.1–1.2 s |
| Total Blocking Time | 1,910 ms | 0–30 ms |
| Cumulative Layout Shift | 0.235 | 0.058–0.06 |
| Speed Index | 18.8 s | 0.8–1.0 s |
| Page weight | 8,921 KiB | 1,786 KiB (1,470 KiB of it is the two DejaVu TTFs) |

`npm test` passes. A headless Playwright run of the page reports no console errors or
warnings and no failed requests, 24 table rows, sort/filter/compare (limit 4 + message),
FAQ accordion, newsletter validation, the hero alt text and the promo banner all behave as
before.

## What the baseline said (Step 1–2 of the workflow)

- Network: 1.5 MB `index.html` (a 1.5 MB `<script type="application/json" id="catalogue-snapshot">`
  that nothing reads), 3 MB `hero.png` (1800×1000 shown at ≤992 px), 4 × 630 KB
  `related-*.png`, 236 KB CSS of which ~5 KB is used by this page, 307 KB `tq-analytics.js`.
- Main thread: `js/polyfills.js` spins for 400 ms before first paint (1.6 s under 4× CPU
  throttling) to compute `window.__layoutTier`, which no CSS or JS reads.
- Render blocking: two synchronous `<script>`s in `<head>` ahead of the stylesheet.
- CLS 0.229 came from the promo banner being inserted at the top of `<body>` after load,
  pushing the whole page down; images had no dimensions.
- Data: the table fetched the 24 `product-*.json` records one after another (N+1 waterfall).

## Changes (in order, each measured)

1. **Catalogue snapshot moved out of the HTML** → `data/catalogue-snapshot.json` (not loaded
   by anything; kept in case another tool consumes it). HTML 1.5 MB → 9 KB.
2. **Images**: hero re-encoded to WebP at 480/960/1440 px with `srcset`/`sizes`,
   `width`/`height`, `fetchpriority="high"`; JPEG fallback in `src`. Related images → WebP
   480/900 px, lazy. Avatars → 112 px WebP (shown at 56 px), lazy. All images carry
   dimensions. 5.4 MB → 45 KB. Original PNGs removed.
3. **CSS split**: `css/styles.css` now holds the page styles only (5 KB). The unused "legacy
   component library" (`.ds-*`, 231 KB) lives in `css/legacy-components.css` and is not
   loaded by this page. `font-display: swap` added so text is not blocked on the 1.4 MB TTFs.
   Steps 1–3 together: score 17 → 44, FCP 18.9 s → 10.2 s, LCP 49.7 s → 10.8 s.
4. **Scripts**: `tq-analytics.js` is loaded after the `load` event; a 3-line inline stub
   provides `window.tq` with the vendor's own queue contract (`window.__tqQueue`), so events
   fired before it arrives are queued and picked up (verified: `__tqRegistry` present,
   queued events preserved). `polyfills.js` lost its 400 ms busy loop (`__layoutTier` is now
   a constant; the `requestIdleCallback` polyfill stays) and is `defer`red, as is `app.js`.
   `loadCatalogue()` fetches the 24 detail records with `Promise.all` (order preserved).
   Score 44 → 88, FCP 10.2 s → 0.8 s, LCP 10.8 s → 1.2 s, TBT 1,590 ms → 40 ms.
5. **Promo banner without layout shift**: the banner markup is in `index.html` from the first
   paint (same id/class/copy) with its space reserved but hidden; `showPromoBanner()` still
   runs after load + 300 ms and reveals it with a transform/opacity slide (compositor-only).
   If the static markup is ever missing it falls back to creating the element as before.
   Score 88 → 100, CLS 0.235 → 0.058.

## Ledger (kept and reverted)

| Idea | Baseline → Result | Verdict | Why |
|---|---|---|---|
| Drop 1.5 MB inline snapshot + WebP images + CSS split + font-display swap | 16 → 44, LCP 49.6 s → 10.8 s | kept | Bytes and LCP image were the bottleneck |
| Defer scripts, analytics after load, remove 400 ms spin, parallel fetch | 44 → 88, FCP 10.2 s → 0.8 s, TBT 1.6 s → 40 ms | kept | Render-blocking scripts and the spin were the FCP/TBT bottleneck |
| Reserve banner space, slide in via transform | 88 → 100, CLS 0.235 → 0.058 | kept | Banner insertion was 0.229 of the CLS |
| Metrics-matched local fallback font (`size-adjust: 112%` on Arial) to remove the swap shift | CLS 0.06 → 0.194 | reverted | Guessed metrics made the swap shift worse |

Remaining CLS (~0.06) is the Arial → DejaVu Sans swap. The right fix is subsetting the
fonts to WOFF2 (DejaVu Sans is 760 KB + 709 KB bold); no font tooling (fonttools/woff2) is
available on this machine, so that is left as the next step. `font-display: optional` would
also remove it but changes the typeface on slow first visits.

## Guard

Re-run the README's Lighthouse command before release; budget: performance ≥ 90,
LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms. The three final runs varied by ≤ 0.1 s / 30 ms /
0.002, so a single run is enough to catch a regression of the size fixed here.
