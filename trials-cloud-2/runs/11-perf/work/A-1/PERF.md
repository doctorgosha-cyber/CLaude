# Performance notes

Lighthouse (mobile preset, simulated throttling, `lighthouse --only-categories=performance`,
served by `serve.mjs`):

| | before | after |
|---|---|---|
| Performance score | 18 | 100 |
| First Contentful Paint | 12.0 s | 1.1 s |
| Largest Contentful Paint | 41.4 s | 1.6 s |
| Total Blocking Time | 1,560 ms | 30 ms |
| Cumulative Layout Shift | 0.235 | 0 |
| Speed Index | 12.0 s | 1.1 s |

Page weight on first load went from ~8.9 MB over 43 requests to ~380 KB over 14 requests
(of which 300 KB is the analytics bundle, now loaded after the page is idle).

## What changed

- **index.html**: 1.5 MB → 15 KB. The 1.5 MB inline `#catalogue-snapshot` JSON (a price-history
  export that nothing on the page reads) now lives in `data/catalogue-snapshot.json`; the
  `<script type="application/json" id="catalogue-snapshot" src=…>` tag keeps the id but is not
  fetched by browsers. The used CSS is inlined in `<style>` (no render-blocking stylesheet
  request). Hero image is preloaded with `fetchpriority="high"`; the two subset fonts are
  preloaded. Scripts are `defer`red. All images carry `width`/`height`; below-the-fold images are
  `loading="lazy"`.
- **Promo banner (CLS)**: the banner's box is now in the markup from the first paint, invisible
  (`opacity: 0`, `aria-hidden`); `js/app.js` fades it in after `load` + 300 ms as before, so the
  same id/class/copy appear without pushing the page down.
- **css/styles.css**: 236 KB → 5 KB. Dropped the unused "legacy component library" (`.ds-*`
  rules, 800 selectors never used on this page) and the unused Serif/Mono font faces. Added a
  metric-matched fallback face (`size-adjust`/`ascent-override`) so the `font-display: swap`
  does not move text. The file is the source of the inlined styles.
- **Fonts**: the four DejaVu TTFs (2.2 MB) are replaced by two subset WOFFs (18 KB each) for
  DejaVu Sans Regular/Bold: Basic Latin, Latin-1, Latin Extended-A, general punctuation, €, ™, ★☆,
  hinting stripped. `src: local("DejaVu Sans")` is tried first.
- **Images**: `hero.png` 2.9 MB → WebP at 480/800/1200/1800 px (1.7–9.9 KB) with `srcset`/`sizes`;
  `related-*.png` 630 KB each → 600 px WebP (~1.6 KB); avatars → 112 px WebP (~1 KB, shown at 56 px).
  Same alt text, same layout.
- **js/polyfills.js**: no longer spins the main thread for 400 ms before first paint; the layout
  tier is derived from `navigator.hardwareConcurrency`. The `requestIdleCallback` polyfill stays.
- **js/vendor/tq-analytics.js** (300 KB) is no longer a blocking script in `<head>`. A 150-byte
  inline stub defines `tq()` and the event queue; `app.js` injects the real bundle on idle after
  `load`, and the bundle drains the queued events as before.
- **Data loading**: `data/products.json` now carries each product's detail fields, so the table
  needs one request instead of 25 sequential ones. The `product-<id>.json` files are unchanged and
  `app.js` still fetches them (in parallel) for any catalogue entry missing the fields. Sort,
  filter, compare limit, FAQ, newsletter validation and all ids/classes/`data-*` are unchanged.

Verified: `npm test` passes; the page loads with no console errors and no failed requests;
the table renders 24 rows; the banner appears after load.
