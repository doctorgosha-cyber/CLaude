BLOCKED — the packet's only input, `data/catalogue.json`, is not on disk (0 files matched).

## Blocker
- Packet `## Inputs` names `data/catalogue.json`. `ls data/` shows 2 files: `data/README.txt`, `data/foods.json`. No catalogue export is present anywhere in the run directory.
- `data/README.txt` L2 says the catalogue is the nightly ops cron export (seed + `price_eur` + `pack_kg`, written at 03:10). The 2026-10-29 export appears not to have landed.
- `data/foods.json` (6 products) carries nutrients only: no `price_eur`, no `pack_kg`. Price per 1000 kcal cannot be computed from it, and rebuilding a catalogue from it is exactly the 2025-07 catalogue incident (role card §13).

## What changed
- `REPORT.md`: this file.
- `out/price-per-kcal.csv`: not produced; it depends on the missing input (role card §1).

## Evidence
- Check run: `ls data/catalogue.json` -> "No such file or directory".
- No `package.json` in the run directory, so `npm test` not applicable; no PHP files touched, so `php -l` not applicable.
- Cheapest-three figures: not measured.

## Open questions
- Whether the 03:10 cron failed or the export was simply not copied into this run directory; either way the fix is outside the solo agent's remit (no network, no file creation outside the run directory).
- Once `data/catalogue.json` is present, the energy figure per product is 4 x protein_g + 9 x fat_g + 4 x carbohydrate_g (kcal/100 g), and price per 1000 kcal = `price_eur` / (`pack_kg` x 10 x kcal/100 g) x 1000, assuming `pack_kg` is net weight as fed. Confirm that reading of `pack_kg` when packet `t3` is rerun after the export lands.

NEXT: place the nightly export at `data/catalogue.json`.
