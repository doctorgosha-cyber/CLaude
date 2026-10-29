WORKING — energy table produced for 6 products, highest `nf-002` at 428 kcal/100 g, lowest `nf-004` at 102 kcal/100 g.

What changed
- `out/energy.md` (new): Markdown table, 6 rows, columns Product and Energy (kcal/100 g), sorted highest first.
- `REPORT.md` (this file).

Results
- Highest: Northfield Puppy Lamb (`nf-002`), 428 kcal/100 g (30.0 g protein, 18.0 g fat, 36.5 g carbohydrate).
- Lowest: Riverbank Beef Chunks (`nf-004`), 102 kcal/100 g (101.5 kcal/100 g unrounded; 9.0 g protein, 5.5 g fat, 4.0 g carbohydrate).

Evidence
- Input read: `data/foods.json`, 6 products, all with `protein_g`, `fat_g`, `carbohydrate_g` present.
- Formula: 4 × protein + 9 × fat + 4 × carbohydrate, per 100 g as fed (§10); `fibre_g` and `moisture_pct` not used.
- Computed with a one-off Node 22 script (not kept on disk); rounded to whole kcal in the table, 6 rows written.
- Spot check by hand: `nf-002` = 4×30.0 + 9×18.0 + 4×36.5 = 120 + 162 + 146 = 428 kcal/100 g.
- No `package.json`, so no `npm test`; no PHP touched, so no `php -l`.

Open questions
- Two products land on a half kcal before rounding (`nf-006` 364.5, `nf-004` 101.5); the table rounds half up (365, 102). If the site convention is round-half-even, both drop by 1 kcal.
- The packet says "catalogue seed" but names only `data/foods.json`; `data/catalogue.json` was not read and is not on disk, and was not needed for this table.

NEXT: reviewer commits `out/energy.md`.
