# Performance notes

Baseline (Lighthouse 13, mobile, simulated throttling, median of 3): score 17, LCP 49.7 s, CLS 0.23, TBT 1.6 s, 9.1 MB transferred.

Changes, each measured in isolation before being kept:

| Change | Effect |
|---|---|
| Removed the 1.5 MB inline catalogue snapshot (never read) | FCP 18.9 s -> 8.6 s |
| Dropped the 300 KB analytics bundle (page only needs `tq()`; 60-byte inline queue stub keeps the call working) and the 400 ms busy-wait probe | TBT 1.6 s -> 0.2 s, render no longer blocked |
| Hero: 3 MB PNG -> 480/800/1200 px WebP with srcset, width/height, fetchpriority=high + preload | LCP -> ~1.3 s |
| Related/avatars: WebP, width/height, loading=lazy | 2.5 MB off the critical path, CLS 0 below the fold |
| Fonts: system stack instead of 4 self-hosted TTFs (760 KB on the wire) | no FOIT, no font swap shift |
| CSS: deleted the 400-rule legacy library, inlined the remaining 4 KB | no render-blocking stylesheet |
| Promo banner rendered statically in HTML instead of inserted after paint | CLS 0.23 -> 0 |
| Comparison data: one merged catalogue.json instead of 1 + 24 sequential fetches | table renders ~3.5 s earlier on 4G |
| app.js deferred | not render-blocking |

Result: score 100, LCP ~1.2 s, CLS 0, TBT 0 ms, ~110 KB transferred. All functional behaviour (sort tie-breaks,
brand filter, compare cap of 4, FAQ, newsletter validation) unchanged; `npm test` green.
