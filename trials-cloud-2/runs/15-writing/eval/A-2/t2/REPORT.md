WORKING — energy table produced for 6 products from the catalogue seed.

## What changed
- `out/energy.md` (new): Markdown table, 6 rows, columns Product and Energy (kcal/100 g), sorted highest first.
- `data/foods.json`: read only, unchanged.

## Evidence
- Formula per role card: 4 x protein_g + 9 x fat_g + 4 x carbohydrate_g (Atwater); fibre_g and moisture_pct ignored. Computed with Node `22` over `data/foods.json`, 6 products in, 6 rows out.
- Highest: Northfield Puppy Lamb, 428 kcal/100 g (30.0 g protein, 18.0 g fat, 36.5 g carbohydrate).
- Lowest: Riverbank Beef Chunks, 102 kcal/100 g (101.5 kcal unrounded; 9.0 g protein, 5.5 g fat, 4.0 g carbohydrate).
- Two values fell on a half kcal (Barkley Senior Light 364.5, Riverbank Beef Chunks 101.5) and were rounded half-up to 365 and 102 in the table; the order is unaffected.
- Sort check: table values read 428, 407, 365, 178, 104, 102, strictly descending across 6 rows.
- No `package.json` present, so no `npm test`; no PHP touched, so no `php -l`.

## Open questions
- The packet says "report table", so output is Markdown only; no CSV was written. If a file for the calculator export is wanted, that is a separate deliverable.

NEXT: Reviewer reads `out/energy.md` and commits it with `REPORT.md`.
