WORKING — energy table for 6 products written to `out/energy.md`, highest first.

## What changed
- `out/energy.md` (new): Markdown table, 2 columns (Product, Energy (kcal/100 g)), 6 rows, sorted highest to lowest. Whole kcal per role card §1.
- No PHP touched; no `package.json`, so no `npm test`.

## Evidence
- Input read: `data/foods.json`, 6 products.
- Formula applied: 4 × protein_g + 9 × fat_g + 4 × carbohydrate_g (fibre_g and moisture_pct excluded), computed with Node 22 inline, one-off script not kept.
- Highest: Northfield Puppy Lamb, 428 kcal/100 g (30.0 g protein, 18.0 g fat, 36.5 g carbohydrate).
- Lowest: Riverbank Beef Chunks, 102 kcal/100 g (101.5 kcal full precision; 9.0 g protein, 5.5 g fat, 4.0 g carbohydrate).
- Full-precision values, in table order: 428, 407, 364.5, 178, 104, 101.5 kcal/100 g.
- `out/energy.md` checked on disk: 8 lines, 6 data rows, order verified descending.

## Open questions
- Two values sit on a half (364.5 and 101.5 kcal); rounded half-up to 365 and 102 kcal. If banker's rounding is preferred, 364.5 kcal would become 364 kcal.
- Packet asks for a report table, so Markdown only; no CSV produced.

NEXT: review `out/energy.md` and commit it.
