# PERF.md — what changed and why

Measured with the release-check setup (Lighthouse CLI, mobile preset, simulated throttling,
headless Chromium) against `node serve.mjs` on this machine. Each change was measured on its own,
twice, before the next one was applied; a change that did not beat run-to-run noise was reverted.

| Metric (mobile) | Before | After |
|---|---|---|
| Performance score | 17 / 17 | 95 / 96 |
| LCP | 49.7 s | 2.6–2.8 s |
| FCP | 18.9 s | 0.8 s |
| CLS | 0.229 | 0.06 |
| TBT | 1,680–1,730 ms | 0–30 ms |
| Page weight | 8.9 MB (HTML 1.5 MB, hero PNG 3.0 MB) | 1.8 MB (HTML 9 KB; 1.47 MB of that is the two TTF fonts) |

## Ledger (kept and reverted alike)

| # | Change | Baseline → Result | Verdict | Why |
|---|---|---|---|---|
| A | Removed the inline `catalogue-snapshot` JSON (1.5 MB, read by nothing); removed `js/polyfills.js` (a 400 ms busy-loop setting `__layoutTier`, read by nothing); `defer` on `tq-analytics.js` and `app.js` (order kept, `tq` is defined before `app.js` runs); dropped the unused `.ds-*` legacy CSS (98% of the stylesheet) and the two `@font-face`s nothing referenced. | score 17 → 60/63, FCP 18.9 s → 0.8 s, TBT 1.7 s → 50–70 ms | kept | Document and render-blocking scripts were the critical path. |
| B | Hero re-encoded to WebP at 480/800/1200 w with `srcset`/`sizes`, `width`/`height`, `fetchpriority="high"`; related images and avatars to WebP at display size with dimensions, `loading="lazy"`, `decoding="async"`. PNGs removed. | LCP 32–40 s → 0.9–2.8 s, score → 85/89 | kept | The 3 MB hero PNG was the LCP resource. |
| C | Promo banner markup now ships in `index.html` (same id, class and copy) with its space reserved and hidden via `data-pending`; `app.js` reveals it after load instead of inserting it at the top of `<body>` (falls back to inserting if the markup is absent). | CLS 0.229 → 0.06, score → 95/96 | kept | The late banner insertion pushed `<main>` down; that was the whole 0.229, not the unsized hero. |
| D | Metric-matched local fallback `@font-face` (size-adjust 112–119%) + `font-display: swap` to remove the remaining font-swap shift. | CLS 0.06 → 0.175 (4 runs) | reverted | At 412 px the swap still re-wraps table cells and the banner line, so the shift grows; at 1024 px the layout is a zero-diff. Do not retry without subsetting/metric tooling. |
| — | Unreferenced `fonts/DejaVuSerif.ttf` and `DejaVuSansMono.ttf` deleted. | no change (never requested) | housekeeping | Not an optimisation; they were dead files. |

Not attempted (noted so nobody re-measures it blindly): `app.js` fetches the 24 product detail files
sequentially (25 round trips before the table renders). The table is below the fold on mobile, so it
does not move LCP/CLS/TBT; parallelising it would only help time-to-table and should be measured on
that, not on the Lighthouse score.

## What is left

The two DejaVu TTFs (1.47 MB) are now the largest thing on the page and the only reason LCP is
2.6–2.8 s instead of ~0.9 s (Lighthouse's pessimistic LCP path includes them). No font subsetting
or WOFF2 tooling is available on this machine; subsetting to Latin and converting to WOFF2 would
bring them to roughly 60 KB total and is the next step.

## Guard

`npm test` now also checks the budget that these fixes depend on: `index.html` under 32 KB, no
render-blocking script in `<head>`, the hero declares `width`/`height`, and every image is under
200 KB. The Lighthouse command in README.md is the synthetic check for the score itself.
