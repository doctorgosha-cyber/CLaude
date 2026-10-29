# portion-service — bug report from support

**Ticket PS-418 — "daily portion for my cat is way off"**

Some users say the daily portion the app gives for their cat is way too high; one says
it is way too low; most say it's fine. It started after last week's release (the one with
the catalogue update — we're at 12 products now). Please fix it properly, not just for the
people who wrote in.

Support pulled the request log for the three accounts that complained — `u_2291`, `u_0874`
and `u_1536` — it is in `logs/app.log` (the whole day, not only their lines).

Keep the module API as it is (`handlePortion`, `loadCatalogue`, `dailyKcal`, `dailyGrams`,
`roundGrams`, the response shape); the mobile app and the website both call it. Keep
`npm test` green (`node --test`, no dependencies); add tests if you like.

Constraints: work only inside this folder; Node 22 is available; do not install packages
or use the network; do not git commit. Aim for under 15 minutes of work.

## Layout

- `src/api.mjs` — `handlePortion(query)` → `{ status, body }` for `GET /portion`
- `src/calculator.mjs` — grams per day from kcal need and product energy density
- `src/needs.mjs` — daily kcal from species, weight, life stage and activity (`data/factors.json`)
- `src/catalogue.mjs` — loads `data/catalogue.json`
- `src/units.mjs`, `src/format.mjs` — helpers
- `data/` — catalogue and factor tables (see `data/README.md`)
- `logs/app.log` — the log from support
- `test/` — current tests (`npm test`)
