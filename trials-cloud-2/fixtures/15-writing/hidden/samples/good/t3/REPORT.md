BLOCKED — input data/catalogue.json is not on disk.

Checked:
- data/ holds only data/foods.json and data/README.txt; README says data/catalogue.json is written by the ops cron at 03:10, so the nightly export did not run or was not copied into this repo
- data/foods.json has no prices, so price per 1000 kcal cannot be computed from it

Not produced: out/price-per-kcal.csv.

NEXT: re-run or copy the nightly export to data/catalogue.json and re-issue the packet.
