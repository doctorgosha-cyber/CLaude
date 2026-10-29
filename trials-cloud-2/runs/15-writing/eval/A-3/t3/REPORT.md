BLOCKED — listed input `data/catalogue.json` is not on disk.

## What changed
- `REPORT.md` (this file). No other file written; `out/price-per-kcal.csv` not produced.

## Evidence
- `ls data/` shows 2 files: `data/README.txt` (208 bytes) and `data/foods.json` (988 bytes). `cat data/catalogue.json` → "No such file or directory".
- `data/README.txt` L2 says `data/catalogue.json` is the nightly export (seed + `price_eur` + `pack_kg` per product) written by the ops cron at 03:10; it has not been written into this run directory.
- `data/foods.json` holds 6 products with nutrients only (no `price_eur`, no `pack_kg`), so price per 1000 kcal cannot be computed from it. Per role card §2, reconstructing or approximating the catalogue from `foods.json` is not allowed.
- No `package.json` present, so `npm test` not applicable; 0 PHP files touched, so `php -l` not run.

## Open questions
- Once the export is present, the intended formula is price per 1000 kcal = (`price_eur` / (`pack_kg` × 10)) / (energy per 100 g / 1000), with energy per 100 g = 4 × protein_g + 9 × fat_g + 4 × carbohydrate_g (role card §10). Confirm `pack_kg` is net weight as fed.
- Price field precision for the CSV (2 decimal places assumed) was not specified in the packet.

NEXT: supply `data/catalogue.json` (run the 03:10 ops export or copy it into `data/`) and re-run this packet.
