BLOCKED — listed input `data/catalogue.json` is not on disk

## What changed
Nothing. No deliverable was produced: `out/price-per-kcal.csv` depends on the missing input and was not written, and `out/` was not created.

## Blocker
- Packet `## Inputs` lists `data/catalogue.json`; `ls data/` shows 2 files only: `data/README.txt`, `data/foods.json`.
- `find . -name 'catalogue*'` returned 0 files in the run directory.
- `data/README.txt` L2 says `data/catalogue.json` is the nightly shop export (seed + `price_eur` + `pack_kg`), written by the ops cron at 03:10.
- `data/foods.json` (6 products) has nutrients per 100 g but no `price_eur` or `pack_kg`, so price per 1000 kcal cannot be computed from it, and the role card forbids reconstructing or approximating a missing input.

## Evidence
- Checks run: `ls data/` (2 files), `find` for `catalogue*` (0 files), read of `data/README.txt` and `data/foods.json`.
- No PHP or Node files touched; no `package.json` present, so `npm test` not applicable.
- Time used: about 2 minutes of a 10-minute budget.

## Open questions
- Did the 03:10 cron fail last night, or was the export left out of the stripped repo on purpose?
- Once the export exists: is `price_eur` the price per pack (so price per 1000 kcal = price_eur / (pack_kg × 10 × kcal_per_100g) × 1000), or already per kg? The formula is ready either way; the packet does not say.

NEXT: restore `data/catalogue.json` from the nightly export (or confirm the cron ran) and re-run packet `t3`.
