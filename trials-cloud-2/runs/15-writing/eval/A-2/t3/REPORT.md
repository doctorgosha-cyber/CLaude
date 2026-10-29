BLOCKED — listed input `data/catalogue.json` is not on disk, so no price per 1000 kcal can be computed.

## Blocker

- Packet `## Inputs` names `data/catalogue.json`; `ls data/` shows 2 files only: `data/README.txt` and `data/foods.json`.
- `data/README.txt` L2 says the catalogue is a nightly ops-cron export (seed + `price_eur` + `pack_kg` per product) written at 03:10; the export did not land in this run directory.
- A search of the whole run directory for `*catalogue*` / `*catalog*` returned 0 files.

## What changed

- `REPORT.md` written (this file). No other file created or modified.
- `out/price-per-kcal.csv` NOT produced: it depends on the missing input. Nothing was reconstructed, stubbed or sampled to get around it.

## Context read (not depended on)

- `data/foods.json`: 6 products with nutrients per 100 g as fed (`protein_g`, `fat_g`, `carbohydrate_g`, `fibre_g`, `moisture_pct`). It carries no `price_eur` and no `pack_kg`, so price per kcal cannot be derived from it; only the energy side (Atwater 4/9/4) is available.

## Checks run

- `ls data/`: 2 files, no catalogue.
- `find . -iname '*catalogue*' -o -iname '*catalog*'`: 0 files.
- No PHP touched, so `php -l` not applicable; no `package.json`, so `npm test` not applicable.

## Open questions

- Once the export is present, the planned method is: energy per 100 g = 4 x protein_g + 9 x fat_g + 4 x carbohydrate_g (kcal); kcal per pack = energy per 100 g x pack_kg x 10; price per 1000 kcal = price_eur / kcal per pack x 1000; sort ascending; full precision in the CSV, whole-number display in the report table.
- The packet does not say whether `price_eur` is per pack or per kg; the reading above (per pack, with `pack_kg` giving pack size) changes the fewest assumptions and will be stated in the next report if the data confirms it.

NEXT: ops re-runs the 03:10 catalogue export (or copies it) to `data/catalogue.json` in this run directory, then re-run this packet.
