WORKING — energy table written for 6 products, highest 428 kcal/100 g, lowest 102 kcal/100 g.

## What changed
- `out/energy.md` (new): Markdown table, 6 rows (product name, energy in kcal/100 g as fed), sorted highest first. `out/` created for it.
- No PHP or template files touched.

## Evidence
- Input read: `data/foods.json`, 6 products, all with `protein_g`, `fat_g`, `carbohydrate_g`.
- Energy per the role card: 4 × protein + 9 × fat + 4 × carbohydrate, kcal/100 g as fed; `fibre_g` and `moisture_pct` excluded.
- Highest: Northfield Puppy Lamb, 428 kcal/100 g (4 × 30.0 + 9 × 18.0 + 4 × 36.5).
- Lowest: Riverbank Beef Chunks, 102 kcal/100 g (full precision 101.5; 4 × 9.0 + 9 × 5.5 + 4 × 4.0).
- Table values are whole kcal; two products fall on a .5 (Barkley Senior Light 364.5 → 365, Riverbank Beef Chunks 101.5 → 102), rounded half up.
- Computed with a one-off Node script (`node`, 1 run), not stored in the repo. Output of `cat out/energy.md` checked: 6 data rows, descending order.
- `npm test`: not applicable, no `package.json` in the run directory. `php -l`: not applicable, 0 PHP files touched.

## Open questions
- Rounding of .5 values: half-up was used; if the catalogue convention is banker's rounding, 2 rows would change by 1 kcal.
- The packet says "Markdown table" but no table style; a two-column table with a right-aligned energy column was chosen (fewest assumptions).

NEXT: reviewer confirms half-up rounding for the two .5 kcal rows and commits `out/energy.md`.
