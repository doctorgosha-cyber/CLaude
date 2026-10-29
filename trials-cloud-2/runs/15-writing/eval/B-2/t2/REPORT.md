WORKING — energy table written for 6 products, highest first.

## What changed
- `out/energy.md` (new): Markdown table, 6 rows, columns Product and Energy (kcal/100 g), sorted highest to lowest.
- No PHP or template files touched.

## Evidence
- Input read: `data/foods.json`, 6 products.
- Formula: 4 × protein + 9 × fat + 4 × carbohydrate (Atwater), per 100 g as fed; fibre and moisture excluded. Computed with `php -r` (PHP `8.3`), rounded to whole kcal in the table.
- Highest energy: Northfield Puppy Lamb, 428 kcal/100 g.
- Lowest energy: Riverbank Beef Chunks, 102 kcal/100 g (full precision 101.5 kcal/100 g).
- Two rows round from a half: Barkley Senior Light 364.5 → 365 kcal/100 g, Riverbank Beef Chunks 101.5 → 102 kcal/100 g (round half away from zero).
- Checks: no `package.json` in the run directory, so `npm test` not applicable; no PHP file touched, so `php -l` not applicable. Output confirmed with `wc -l`: 8 lines (header, separator, 6 rows).

## Open questions
- The packet asks for whole kcal in the table; a column with full-precision values was not added since the packet did not ask for one.

NEXT: reviewer commits `out/energy.md`.
