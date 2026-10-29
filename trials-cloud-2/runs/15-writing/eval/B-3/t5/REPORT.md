WORKING — 5 pages checked, 3 pages over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ "size_bytes", "budget_bytes", "over" }`, sizes measured on disk with `fs.statSync`.
- No theme file touched; nothing under `figures/` modified.

## Pages over budget

| Page | Size (bytes) | Budget (bytes) | Excess (bytes) | Excess (%) |
| --- | --- | --- | --- | --- |
| `figures/figure-price-per-kcal.html` | 22612 | 20480 | 2132 | 10.4 % |
| `figures/figure-weight-curve.html` | 18434 | 16384 | 2050 | 12.5 % |
| `figures/figure-moisture.html` | 12002 | 12000 | 2 | 0.0 % |

Total excess: 4184 bytes across 3 pages.

Within budget: `figures/figure-energy-density.html` (9102 bytes of 10240 bytes), `figures/figure-protein-share.html` (7282 bytes of 8192 bytes).

## Evidence
- `wc -c figures/*.html` matches `size_bytes` in `out/budget.json` on all 5 files (69432 bytes total).
- Every `.html` under `figures/` has a budget in `figures/targets.json`; every budget key has a file (5 keys, 5 files, 0 orphans).
- `over` is strict (`size > budget`); a page exactly on budget would read `false`.
- No `package.json` in the run directory, so no `npm test`; no PHP touched, so no `php -l`.

## Open questions
- `figure-moisture.html` is over by 2 bytes against a budget of 12000 bytes, while the other four budgets are multiples of 1024 bytes (the nearest would be 12288 bytes). Flagged as over per the packet; may be a typo in `figures/targets.json`.
- The two large pages are over by about 2 KB each; their bulk is the inline SVG `<rect>` data, not CSS or JSON-LD. Trimming them is out of this packet's scope.

NEXT: confirm whether the 12000-byte budget for `figure-moisture.html` in `figures/targets.json` is intended before trimming the two 2 KB overruns.
