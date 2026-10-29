WORKING — energy table produced for 6 products, sorted highest first.

## What changed
- `out/energy.md` (new): Markdown table, 6 rows, product name and energy (kcal/100 g as fed), highest first, rounded to whole kcal.
- `REPORT.md` (this file).

## Results
- Highest: Northfield Puppy Lamb (`nf-002`), 428 kcal/100 g.
- Lowest: Riverbank Beef Chunks (`nf-004`), 102 kcal/100 g (101.5 kcal before rounding).

## Evidence
- Input: `data/foods.json`, 6 products, all with `protein_g`, `fat_g`, `carbohydrate_g` present.
- Formula: 4 × protein + 9 × fat + 4 × carbohydrate (Atwater), per §10 of the role card; `fibre_g` and `moisture_pct` not used.
- Computed with Node `22` inline script; full-precision values: 428, 407, 364.5, 178, 104, 101.5 kcal/100 g. Table rounds 364.5 → 365 and 101.5 → 102 (half up).
- No `package.json` in the run directory, so no `npm test`. No PHP touched, so no `php -l`.
- Elapsed: not measured; well under the 10 min budget.

## Open questions
- Two products sit exactly on .5 kcal; the table uses round-half-up. If the catalogue export uses banker's rounding, those two rows would read 364 and 102 (`nf-004` unchanged, `nf-006` differs by 1 kcal).
- The packet says "current catalogue seed"; only `data/foods.json` is listed, and no `data/catalogue.json` exists in the run directory, so the seed file was used as-is.

NEXT: confirm the rounding rule for exact .5 kcal values before the table is published.
