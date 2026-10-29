WORKING — 3 pages of 5 are over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ size_bytes, budget_bytes, over }`, two-space indent.
- No PHP or figure page touched; the check is read-only.

## Over budget

| Page | Size (bytes) | Budget (bytes) | Excess (bytes) |
| --- | --- | --- | --- |
| `figure-price-per-kcal.html` | 22612 | 20480 | 2132 |
| `figure-weight-curve.html` | 18434 | 16384 | 2050 |
| `figure-moisture.html` | 12002 | 12000 | 2 |

Total excess: 4184 bytes across 3 pages.

Under budget: `figure-energy-density.html` (9102 bytes, 1138 bytes headroom), `figure-protein-share.html` (7282 bytes, 910 bytes headroom).

## Evidence
- Sizes measured with `wc -c` and `fs.statSync().size` on disk, both agree on all 5 files.
- `figures/targets.json` has 5 entries; every page under `figures/` has a budget and every budget has a page (0 orphans either way).
- `out/budget.json` parses as JSON (written by `JSON.stringify`, 5 keys).
- No `package.json` in the repo, so `npm test` not applicable; no PHP touched, so `php -l` not applicable.

## Open questions
- `figure-moisture.html` is over by 2 bytes; a trailing newline or one shortened attribute would clear it, but the packet asked only to flag, not to fix.
- The two larger pages (2132 bytes and 2050 bytes over) need either trimming of their inline SVG or a raised budget in `figures/targets.json`; which one is a reviewer call.

NEXT: decide whether to raise the budgets in `figures/targets.json` or trim `figure-price-per-kcal.html` and `figure-weight-curve.html` before the host migration.
