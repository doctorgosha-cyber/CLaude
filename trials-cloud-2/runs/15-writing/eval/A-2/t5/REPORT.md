WORKING — 3 pages of 5 over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ "size_bytes", "budget_bytes", "over" }`, measured with `fs.statSync` on disk against `figures/targets.json`.
- `REPORT.md` (this file). No figure page or input was modified.

## Pages over budget

| Page | Size (bytes) | Budget (bytes) | Excess (bytes) |
| --- | --- | --- | --- |
| `figures/figure-price-per-kcal.html` | 22612 | 20480 | 2132 |
| `figures/figure-weight-curve.html` | 18434 | 16384 | 2050 |
| `figures/figure-moisture.html` | 12002 | 12000 | 2 |

Total excess: 4184 bytes across 3 pages.

Within budget: `figures/figure-energy-density.html` (9102 bytes of 10240 bytes, 1138 bytes headroom) and `figures/figure-protein-share.html` (7282 bytes of 8192 bytes, 910 bytes headroom).

## Evidence
- `wc -c figures/*.html` matches `size_bytes` in `out/budget.json` on 5 files (69432 bytes total).
- Every `.html` under `figures/` has a budget in `figures/targets.json` and every budget has a file: 5 of 5 matched, 0 orphans.
- `out/budget.json` parses with `JSON.parse` (1 file, 5 keys).
- No `package.json`, so no `npm test`; no PHP touched, so no `php -l`.

## Open questions
- `figure-moisture.html` is over by 2 bytes only; a trailing newline or one shortened attribute would bring it under. Flagged as over because the role card says the budget is measured on disk, no tolerance.
- Over-budget pages stay PARTIAL for the migration until trimmed or until a packet raises their budgets; this packet asked only for the check, so no page was edited.

NEXT: trim `figures/figure-price-per-kcal.html` by at least 2132 bytes (the largest excess), then re-run the check.
