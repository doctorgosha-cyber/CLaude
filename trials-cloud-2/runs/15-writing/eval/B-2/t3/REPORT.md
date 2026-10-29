BLOCKED — listed input `data/catalogue.json` is not on disk, so no price figure can be computed.

## Blocker
- Packet `## Inputs` names `data/catalogue.json` (the nightly export with `price_eur` and `pack_kg` per product, per `data/README.txt` L2). The file is absent: `data/` holds 2 files only, `README.txt` and `foods.json`.
- `data/foods.json` (6 products) carries nutrients per 100 g but no price and no pack size, so price per 1000 kcal cannot be derived from it. The role card forbids a reconstruction or stub of the missing input, so nothing was fabricated.

## What changed
- `REPORT.md`: this report. No other file was created or edited.

## Not produced
- `out/price-per-kcal.csv`: depends on the missing input.
- The three cheapest products with their figures: not measured.

## Evidence
- `find` over the run directory: 5 files, none named `catalogue.json`.
- `grep` for `price_eur` / `pack_kg` across the run directory: 1 hit, the description line in `data/README.txt`.

## Open questions
- `data/README.txt` says the export is written by the ops cron at 03:10; it may have failed or not been copied into this run. Once the file lands, the computation is: energy (kcal/100 g) = 4 × protein + 9 × fat + 4 × carbohydrate, kcal per pack = energy × pack_kg × 10, price per 1000 kcal = price_eur / kcal per pack × 1000.

NEXT: Place the nightly export at `data/catalogue.json` (id, nutrients, `price_eur`, `pack_kg` per product) and rerun the packet.
