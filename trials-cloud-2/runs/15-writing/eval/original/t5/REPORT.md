WORKING — 3 pages of 5 pages are over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ size_bytes, budget_bytes, over }`, from `figures/targets.json` and the sizes on disk. No figure page was modified.

## Over budget

| Page | Size (bytes) | Budget (bytes) | Excess (bytes) |
| --- | --- | --- | --- |
| `figures/figure-price-per-kcal.html` | 22612 | 20480 | 2132 |
| `figures/figure-weight-curve.html` | 18434 | 16384 | 2050 |
| `figures/figure-moisture.html` | 12002 | 12000 | 2 |

Total excess: 4184 bytes across 3 pages.

## Under budget

| Page | Size (bytes) | Budget (bytes) | Headroom (bytes) |
| --- | --- | --- | --- |
| `figures/figure-energy-density.html` | 9102 | 10240 | 1138 |
| `figures/figure-protein-share.html` | 7282 | 8192 | 910 |

## Evidence
- Sizes measured with `fs.statSync().size` in Node `22` (bytes on disk, matches `wc -c` for all 5 files).
- `figures/targets.json` lists 5 pages; `figures/` holds 5 `.html` files; 0 pages without a budget, 0 budgets without a page.
- `out/budget.json` re-parsed with `JSON.parse` clean; 533 bytes, two-space indent, Unix line endings.
- No `package.json` in the run directory, so `npm test` not applicable; no PHP touched, so `php -l` not applicable.

## Open questions
- `figures/figure-moisture.html` is over by only 2 bytes; a trailing newline or one trimmed attribute clears it. Parked behind NEXT, together with the re-run of this check after the trims.
- Budgets were not raised by the packet, so all 3 over pages still count as over for the migration.

NEXT: trim `figures/figure-price-per-kcal.html` by at least 2132 bytes, the largest excess.
