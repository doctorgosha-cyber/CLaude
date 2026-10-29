BLOCKED — listed input `data/catalogue.json` is missing from disk

What changed
- Nothing. `out/price-per-kcal.csv` was not produced; no file was created or edited besides this report.

Evidence
- Packet `## Inputs` names 1 file, `data/catalogue.json`; `ls data/` shows 2 files: `README.txt`, `foods.json`.
- `data/README.txt` L2 says `catalogue.json` is the nightly ops export (seed + `price_eur` + `pack_kg` per product), written by cron at 03:10.
- `data/foods.json` holds nutrients only (checked: no `price_eur`, no `pack_kg`), so price per 1000 kcal cannot be computed from it, and the role card forbids reconstructing a listed input from a similar file.
- Checks: `npm test` not run (no `package.json`); `php -l` not run (0 PHP files touched).

Open questions
- Did the 03:10 cron fail tonight, or was the run folder stripped before the export was copied in?
- Once the export is present: compute energy per 100 g (Atwater, 4P + 9F + 4C), kcal per pack = energy × pack_kg × 10, price per 1000 kcal = price_eur / kcal_per_pack × 1000; CSV cheapest first, 3 cheapest into the report.

NEXT: place the nightly export at `data/catalogue.json` and rerun this packet.
