BLOCKED — listed input `data/catalogue.json` is not on disk; no deliverable produced.

## Blocker
- PACKET.md L5 lists `data/catalogue.json` as the only input. It does not exist in `data/` (the folder holds 2 files: `README.txt`, `foods.json`).
- `data/README.txt` says the catalogue is the nightly ops-cron export (seed + `price_eur` + `pack_kg`) written at 03:10. `data/foods.json` (988 bytes, 6 products) carries nutrients only, no price or pack size, so price per 1000 kcal cannot be computed from it and reconstructing or approximating the catalogue is forbidden by the role card.

## What changed
- Nothing. `out/price-per-kcal.csv` was not written; `out/` was not created.

## Evidence
- `ls data/`: 2 files, no `catalogue.json`.
- `package.json`: absent, so no `npm test` to run. No PHP touched, no `php -l` needed.

## Open questions
- Once the export lands, confirm the price basis: per-100 g price = `price_eur / (pack_kg * 10)`, energy per 100 g = 4 × protein + 9 × fat + 4 × carbohydrate, then price per 1000 kcal = per-100 g price / energy × 1000. Fibre and moisture stay out of the energy figure.
- CSV rounding for `price_per_1000kcal_eur`: role card says full precision in files; assumed unrounded unless told otherwise.

NEXT: restore `data/catalogue.json` (re-run the 03:10 ops export or copy last night's file into `data/`), then re-run this packet.
