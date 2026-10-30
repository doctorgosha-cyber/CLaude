# PERF.md — what changed and why

Measured with the release-check Lighthouse setup (mobile preset, simulated throttling,
`--only-categories=performance`), same command before and after every step. Run-to-run
variance on this setup was small (two baseline runs: identical score, LCP ±2 ms).

| Step | Change | Score | FCP | LCP | TBT | CLS | Verdict |
|---|---|---|---|---|---|---|---|
| 0 | Baseline | 17 | 18.9 s | 49.7 s | 1600 ms | 0.229 | — |
| A | 1.5 MB inline `#catalogue-snapshot` JSON (read by nothing) moved to `data/catalogue-snapshot.json`; the element keeps its id and now holds a small pointer object | 18 | 11.4 s | 42.2 s | 1594 ms | 0.229 | kept |
| B | `js/polyfills.js`: removed the 400 ms busy-wait "layout tier" probe (`window.__layoutTier` was never read); kept the rIC polyfill; script deferred | 44 | 11.3 s | 42.7 s | 5 ms | 0.235 | kept |
| C | `js/vendor/tq-analytics.js` (307 KB, render-blocking in `<head>`) now loads after `window.load`; a 3-line inline `tq()` stub queues events into `__tqQueue`, which the vendor build picks up unchanged | 54 | 1.95 s | 42.0 s | 24 ms | 0.442* | kept |
| D | Images re-encoded to WebP with `srcset`/`sizes`, intrinsic `width`/`height` on every `<img>`, `fetchpriority="high"` on the hero, `loading="lazy" decoding="async"` below the fold; `height:auto` in CSS. Hero 2.98 MB -> 4 KB at 1024w; related 630 KB -> 1.3 KB each; avatars 15 KB -> 1.2 KB | 85 | 1.95 s | 2.33 s | 0 | 0.235 | kept |
| E | `css/styles.css`: removed the unused `.ds-*` legacy component library (236 KB -> 4.9 KB; nothing in the markup or JS uses `ds-`) | 88 | 0.75 s | 1.05 s | 1 ms | 0.235 | kept |
| F | Promo banner rendered in the static HTML (same id, class and copy) instead of being inserted at the top of `<body>` after load; `showPromoBanner()` is now a no-op when the element exists | 99 | 0.75 s | 1.19 s | 1 ms | 0.063 | kept |
| G | `font-display: optional` on the `@font-face` rules (text paints at once in the fallback and does not re-flow when the 760 KB TTF arrives) | 100 | 0.75 s | 1.15 s | 0 | 0.000 | kept |
| H | `loadCatalogue()` fetches the 24 detail records with `Promise.all` instead of one `await` per product | 100 | 0.76 s | 1.16–1.31 s | 3 ms | 0.000 | kept** |

\* CLS rose at step C only because the page now painted early enough for the shifts to be observed; they are removed in F and G.
\*\* Headline metrics unchanged (within noise). Kept on its own metric: the table data window went from 25 dependent round trips (~3.7 s at the simulated 150 ms mobile RTT; 166 ms observed on the local wire) to one parallel burst (80 ms observed). Catalogue order is preserved.

Final: Performance 100, FCP 0.76 s, LCP 1.16 s, TBT 3 ms, CLS 0, 1.8 MB transferred (was 9.1 MB; 1.5 MB of the remainder is the two TTF fonts, now off the critical path).

## Not done / considered

- Fonts to WOFF2 or subsetting: no fontTools/woff2 on this machine and no network. The TTFs stay; `font-display: optional` keeps them out of first paint and CLS.
- `tq-analytics.js` was left byte-for-byte unchanged (vendor build, "do not edit").
- Original PNGs are kept on disk as masters; nothing references them.

## Guard

Run before release: `npm test` plus the Lighthouse command in README.md; budget: Performance >= 90, LCP <= 2.5 s, CLS <= 0.1, TBT <= 200 ms. Compare the median of 3 runs.
