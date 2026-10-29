WORKING — 3 pages of 5 pages are over budget, total excess 4184 bytes.

## What changed
- `out/budget.json` (new): 5 entries keyed by file name, each `{ size_bytes, budget_bytes, over }`, computed from bytes on disk vs `figures/targets.json`.
- `REPORT.md` (this file). No figure page or target was edited.

## Result

| Page | Size (bytes) | Budget (bytes) | Over by (bytes) | Over |
| --- | --- | --- | --- | --- |
| `figure-price-per-kcal.html` | 22612 | 20480 | 2132 | yes |
| `figure-weight-curve.html` | 18434 | 16384 | 2050 | yes |
| `figure-moisture.html` | 12002 | 12000 | 2 | yes |
| `figure-energy-density.html` | 9102 | 10240 | -1138 | no |
| `figure-protein-share.html` | 7282 | 8192 | -910 | no |

Total excess over the 3 over-budget pages: 4184 bytes (4.1 KB). Total of all 5 pages: 69432 bytes.

## Evidence
- Sizes measured with `fs.statSync().size` (Node `22`) and cross-checked with `wc -c`: identical on 5 files.
- Every file under `figures/*.html` has an entry in `figures/targets.json` and every target has a file: 0 unmatched names either way.
- `out/budget.json` parses with `JSON.parse`: clean. Two-space indent, Unix line endings.
- Side check: 0 CRLF line endings in the 5 pages, 0 `<script src` tags; the 2-byte overrun on `figure-moisture.html` is not a line-ending artefact.
- No `package.json` in the repo, so no `npm test`; no PHP touched, so no `php -l`.

## Open questions
- `figure-moisture.html` is over by 2 bytes against a non-power-of-two budget (12000 bytes, the others are 8/10/16/20 KiB): confirm whether 12000 is intended or a typo for 12288 before trimming it.
- `figure-weight-curve.html` (over by 2050 bytes) also needs trimming or a raised budget; parked behind the larger `figure-price-per-kcal.html` overrun.

NEXT: trim `figure-price-per-kcal.html` by at least 2132 bytes (or raise its budget in `figures/targets.json`) before the host migration.
