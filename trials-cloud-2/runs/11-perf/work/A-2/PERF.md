# Performance notes

Lighthouse (mobile preset, simulated throttling, same CLI as the release check):

| | before | after |
|---|---|---|
| Performance score | 17 | 100 |
| FCP | 18.9 s | 0.8 s |
| LCP | 49.7 s | 1.2 s |
| TBT | 1,640 ms | 30 ms |
| CLS | 0.229 | 0 |
| Bytes on load | 9.1 MB | 0.35 MB (of which 0.3 MB is the analytics bundle, loaded after the page is idle) |

## What changed

- **index.html** shrank from 1.5 MB to 15 KB. The inline `catalogue-snapshot` JSON (1.5 MB, read by nothing)
  moved to `data/catalogue-snapshot.json`; the HTML keeps a small `#catalogue-snapshot` stub pointing at it.
- **CSS**: the unused legacy `ds-*` component library (230 KB) is gone; the ~5 KB of page styles are inlined in
  `<style>` so there is no render-blocking request. `css/styles.css` no longer exists.
- **Fonts**: only "DejaVu Sans" (regular + bold) was ever used, so the Serif and Mono files are gone. The two
  remaining faces use `src: local(...)` first and `font-display: optional`, so text renders at once in the fallback
  and never reflows (no CLS); the TTFs still download in the background for repeat visits where not installed.
- **Images**: the hero (3 MB PNG) is now WebP at 480/800/1200/1600 w with `srcset`/`sizes`, `width`/`height`
  and `fetchpriority="high"`; the related images are 400/800 w WebP and avatars 112 px WebP, both `loading="lazy"`.
  All images are sized, so nothing jumps. Old PNGs removed.
- **JavaScript**: `js/polyfills.js` ran a 400 ms busy loop before first paint to compute `__layoutTier`, which
  nothing reads; it is now a one-line inline assignment plus the `requestIdleCallback` polyfill. The 300 KB
  `tq-analytics.js` vendor bundle is no longer a synchronous script in `<head>`: a 3-line inline shim defines the
  same `tq()` queue up front and `app.js` injects the bundle via `requestIdleCallback` after `load` (the bundle
  then takes over the queue unchanged). `app.js` is loaded with `defer`.
- **Data loading**: `app.js` fetches the 24 `product-<id>.json` records in parallel instead of one after another
  (same data contract, same merge, same editor's order).
- **Promo banner**: the banner is now in the static markup at the top of `<body>` with `aria-hidden="true"`
  (`visibility: hidden`, space reserved). `showPromoBanner()` reveals it on the same schedule as before
  (`load` -> 2 rAF -> 300 ms) and still creates it if the markup lacks it. Same id, class and copy, zero layout shift.

All ids, classes and `data-*` hooks are unchanged; `npm test` passes; a headless run shows no console errors
or failed requests, and sort / filter / compare limit / FAQ / newsletter validation behave as before.
