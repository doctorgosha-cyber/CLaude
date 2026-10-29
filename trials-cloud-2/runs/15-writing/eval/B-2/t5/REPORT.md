WORKING — 3 of 5 figure pages are over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ size_bytes, budget_bytes, over }`, two-space indent, Unix line endings.
- No other file touched; `figures/` and `figures/targets.json` read only.

## Result

| Page | Size (bytes) | Budget (bytes) | Over by (bytes) | Over by (%) |
| --- | ---: | ---: | ---: | ---: |
| `figure-price-per-kcal.html` | 22612 | 20480 | 2132 | 10.4 |
| `figure-weight-curve.html` | 18434 | 16384 | 2050 | 12.5 |
| `figure-moisture.html` | 12002 | 12000 | 2 | 0.0 |
| `figure-energy-density.html` | 9102 | 10240 | under by 1138 | — |
| `figure-protein-share.html` | 7282 | 8192 | under by 910 | — |

- Over budget: 3 pages. Total excess: 4184 bytes. Under budget: 2 pages.
- Every page under `figures/` has an entry in `figures/targets.json` and every target has a file: 5 files, 5 targets, 0 unmatched.

## Evidence
- Sizes measured with `filesize()` on disk (same figures as `wc -c`: 69432 bytes across 5 files).
- `over` is strict: `size_bytes > budget_bytes`, so a page exactly at budget would pass; `figure-moisture.html` is 2 bytes over, not at budget.
- `out/budget.json` re-parsed with `json_decode`: valid. `grep` for CR bytes: 0 in all 6 files.
- No PHP file touched, so `php -l` not applicable; no `package.json`, so `npm test` not applicable.

## Open questions
- `figure-moisture.html` sits 2 bytes over a 12000-byte budget while the other budgets are powers of two (16384, 10240, 20480, 8192); if 12000 was meant to be 12288, the page is under and the excess drops to 4182 bytes. Not changed.
- The packet asked only for the check, so no page was trimmed.

NEXT: Trim `figure-price-per-kcal.html` by at least 2132 bytes (the largest excess) or get the budget raised in `figures/targets.json` before the host migration.
