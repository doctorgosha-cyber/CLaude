# Performance notes

Lighthouse (mobile preset, simulated throttling, `--only-categories=performance`):

| | before | after |
|---|---|---|
| Performance score | 17 | 100 |
| FCP | 18.9 s | 0.9 s |
| LCP | 49.7 s | 1.3 s |
| TBT | 1,570 ms | 20 ms |
| CLS | 0.229 | 0 |
| Speed Index | 18.9 s | 0.9 s |

## What changed

- **Inline catalogue snapshot (1.5 MB of JSON in `<head>`)**: nothing on the page read it. Moved to
  `data/catalogue-snapshot.json`; the `#catalogue-snapshot` element stays as a small stub that points at the file.
- **Images**: PNGs (hero 3 MB, 4 x 630 KB related, 5 x 16 KB avatars) re-encoded as WebP (q80) at display sizes
  with `srcset`/`sizes`, explicit `width`/`height` (no layout shift), `fetchpriority="high"` on the hero,
  `loading="lazy"` on everything below the fold. Total image weight ~5 MB -> ~45 KB (all sizes). `img/*.png` removed.
- **CSS**: `css/styles.css` was 236 KB, of which ~5 KB was used; the rest was an unused legacy `.ds-*` component
  library. The used rules are now inlined in `index.html` (no render-blocking request); the file is gone.
- **Fonts**: the Serif and Mono faces were declared but never used, so their `@font-face` rules and TTFs are gone.
  Sans/Sans-Bold stay but with `font-display: optional` and `local()` sources first, so text paints immediately
  and never reflows; the TTFs are fetched in the background and used from cache on later visits.
- **`js/polyfills.js`**: contained a 400 ms busy-wait before first paint to compute `window.__layoutTier`, which no
  stylesheet or script reads. Replaced by a trivial inline computation (+ the `requestIdleCallback` polyfill).
- **`js/vendor/tq-analytics.js`** (307 KB, render-blocking): untouched, but now loaded after `load` on an idle
  callback. A tiny inline `tq()` stub queues events into `window.__tqQueue`, which the library adopts, so no
  events are lost.
- **`js/app.js`**: detail records are fetched in parallel (`Promise.all`) instead of 24 sequential round trips;
  script tag is `defer`. Rendering, sort/filter/compare rules and markup are unchanged.
- **Promo banner**: it used to be inserted at the top of `<body>` after load, pushing the whole page down (the
  CLS). Its markup now ships in `index.html` with space reserved but `visibility: hidden` (`data-pending`);
  `showPromoBanner()` still runs on the same load + rAF + 300 ms schedule and reveals it with a transform
  slide-in, which does not shift layout. Same id, class and copy.

Verified: `npm test` passes; a headless Chromium run shows 24 rows, sort/filter/compare limit, FAQ, newsletter
validation, hero alt text and the banner all behaving as before, with no console messages or failed requests.
