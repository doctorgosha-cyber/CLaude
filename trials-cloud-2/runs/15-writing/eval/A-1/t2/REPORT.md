WORKING — energy table produced for 6 products, highest first.

## What changed
- `out/energy.md` (new): Markdown table, 6 rows, columns `Product` and `Energy (kcal/100 g)`, sorted highest first.
- No PHP or template files touched; `REPORT.md` is the only other file written.

## Results
- Highest energy: Northfield Puppy Lamb, 428 kcal/100 g as fed.
- Lowest energy: Riverbank Beef Chunks, 102 kcal/100 g as fed (101.5 kcal before rounding).

## Evidence
- Formula per §9: 4 × protein_g + 9 × fat_g + 4 × carbohydrate_g; fibre_g and moisture_pct excluded.
- Computed with a one-off Node 22 script over `data/foods.json` (6 products read, 0 missing fields); whole-kcal rounding applied in the table only.
- Full-precision values: 428, 407, 364.5, 178, 104, 101.5 kcal/100 g (6 values).
- `npm test`: not run, no `package.json` in the run directory. `php -l`: not run, 0 PHP files touched.
- Checked `out/energy.md` is 8 lines (2 header lines + 6 product rows).

## Open questions
- Two products sit on a half-kcal (364.5 and 101.5 kcal/100 g); rounded half-up to 365 and 102 kcal. If round-half-even is preferred, the table rows for Barkley Senior Light and Riverbank Beef Chunks change by 1 kcal each.
- The packet says "current catalogue seed"; `data/catalogue.json` (nightly export) is not present, so `data/foods.json` was used as the sole input as listed.

NEXT: Review `out/energy.md` and commit it with this report.
