WORKING — 3 pages of 5 pages are over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ size_bytes, budget_bytes, over }`, sizes measured on disk, budgets from `figures/targets.json`.
- `REPORT.md` (this file).

No files under `figures/` were touched.

## Pages over budget

| Page | Size (bytes) | Budget (bytes) | Excess (bytes) | Excess (%) |
| --- | --- | --- | --- | --- |
| `figures/figure-weight-curve.html` | 18434 | 16384 | 2050 | 12.5 |
| `figures/figure-price-per-kcal.html` | 22612 | 20480 | 2132 | 10.4 |
| `figures/figure-moisture.html` | 12002 | 12000 | 2 | 0.0 |

Total excess: 4184 bytes across 3 pages.

Within budget: `figures/figure-energy-density.html` (9102 bytes of 10240 bytes), `figures/figure-protein-share.html` (7282 bytes of 8192 bytes).

## Evidence
- Sizes: `wc -c figures/*.html`, 5 files, 69432 bytes total; identical to `fs.statSync().size` used to write `out/budget.json`.
- Budgets: `figures/targets.json`, 5 keys; every page has a budget and every budget has a page (0 mismatches).
- `out/budget.json` parses with `JSON.parse` (1 file, 5 entries, 3 entries with `over: true`).
- No `package.json` in the run directory, so `npm test` not applicable; no PHP touched, so `php -l` not applicable.

## Open questions
- "Over" is strict (`size_bytes > budget_bytes`); a page exactly at budget counts as within. `figure-moisture.html` is over by only 2 bytes, so a single trailing newline would decide it.
- Whether the two 10 %+ overruns should be trimmed or their budgets raised is a packet decision, not made here.

NEXT: trim `figures/figure-price-per-kcal.html` by at least 2132 bytes (or raise its budget in `figures/targets.json`) before the host migration.
