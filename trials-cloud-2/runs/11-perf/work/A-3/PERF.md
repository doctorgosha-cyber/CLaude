# Performance notes

Lighthouse (mobile preset, simulated throttling, `serve.mjs`), before -> after:

| Metric | Before | After |
| --- | --- | --- |
| Performance score | 17 | 100 |
| First Contentful Paint | 18.9 s | 0.7 s |
| Largest Contentful Paint | 49.7 s | 1.0 s |
| Total Blocking Time | 1,620 ms | 0 ms |
| Cumulative Layout Shift | 0.229 | 0 |
| Speed Index | 18.9 s | 0.7 s |

Critical-path bytes before the first paint went from ~5.3 MB (1.5 MB HTML, 236 KB CSS,
307 KB analytics, 3 MB hero PNG, 1.5 MB fonts) to ~18 KB (14 KB HTML + 3.7 KB hero).

## What changed

- **index.html**: removed the 1.5 MB inline `catalogue-snapshot` JSON island, which nothing
  on the page read (it now lives in `data/catalogue-snapshot.json`, unreferenced). The page
  styles are inlined in a `<style>` block (no render-blocking stylesheet request).
- **css/styles.css**: dropped the 230 KB of unused `.ds-*` "legacy component library"
  rules (no element on the page or in `app.js` uses them). Only the DejaVu Sans faces that
  the page actually uses are declared, with `font-display: optional` so text paints at
  once with the fallback and never reflows. The Serif/Mono faces were never referenced.
  The file is kept as the source of truth for the inlined block.
- **Images**: hero re-encoded to WebP at 640/1024/1600 px (`srcset`/`sizes`,
  `fetchpriority="high"`), related images to 480 px WebP, avatars to 112 px WebP, all with
  `width`/`height` attributes; below-the-fold images are `loading="lazy"`. Original PNGs
  are left in `img/` but no longer referenced. Alt text is unchanged.
- **js/polyfills.js**: removed. It spun the main thread for 400 ms before first paint to set
  `window.__layoutTier`, which nothing reads. Its `requestIdleCallback` shim is now inline.
- **js/vendor/tq-analytics.js** (307 KB) is no longer render-blocking: a 3-line inline stub
  defines the same `tq()` queue API, and the vendor build is injected after `load` on idle;
  it drains the same `__tqQueue`, so no events are lost.
- **js/app.js**: the 24 product detail records are fetched in parallel instead of one after
  another (editor's order preserved); loaded with `defer`. The promo banner markup is now
  pre-rendered at the top of `<body>` (invisible but occupying its space) and `showPromoBanner`
  reveals it after load, so it no longer pushes the whole page down (this was the 0.23 CLS).
  Same id, class names and copy; the old create-and-insert path remains as a fallback.

No markup hooks, ids, class names or `data-*` attributes were changed; sort/filter/compare,
FAQ, newsletter validation, reviews and the hero alt text were checked in headless Chromium
with no console errors or failed requests. `npm test` passes.
