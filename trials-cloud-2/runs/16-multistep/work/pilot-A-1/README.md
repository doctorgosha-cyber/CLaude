# portion-service — bug report from support

**Ticket PS-418 — "daily portion for my cat is way off"**

Some users say the daily portion the app gives for their cat is way too high; one says
it is way too low; most say it's fine. It started after last week's release (the one
with the catalogue update — we're at 12 products now). Please fix it properly, not just
for the three people who wrote in.

Support pulled the request log for the three accounts that complained — `u_2291`,
`u_0874` and `u_1536` — it is in `logs/app.log` (the whole day, not only their lines).

What we need from you:

1. Find the cause(s) and fix them in `src/` and/or `data/`. Keep the module API
   (`handlePortion`, `loadCatalogue`, `dailyKcal`, `dailyGrams`, response shape) as it is;
   the mobile app and the website both call it.
2. We would rather the service refuse to start than quote nonsense: after normalisation
   every product must be between 250 and 600 kcal per 100 g, and `loadCatalogue` must
   throw if any product falls outside that range.
3. The supplier feed is hand-edited and its unit spellings vary from export to export,
   so the loader has to be tolerant of that.
4. Keep `npm test` green (`node --test`, no dependencies). Add tests if you like.

Constraints: work only inside this folder; Node 22 is available; do not install packages
or use the network; do not git commit. Aim for under 15 minutes of work.

## Layout

- `src/api.mjs` — `handlePortion(query)` → `{ status, body }` for `GET /portion`
- `src/calculator.mjs` — grams per day from kcal need and product energy density
- `src/needs.mjs` — daily kcal from species, weight (kg), life stage and activity (`data/factors.json`)
- `src/catalogue.mjs` — loads `data/catalogue.json`, normalises energy to kcal/100 g
- `src/units.mjs`, `src/format.mjs` — helpers
- `data/catalogue.json` — current catalogue (12 products), `data/factors.json`
- `logs/app.log` — the log from support
- `test/` — current tests (`npm test`)

Query parameters for `/portion`: `species` (cat|dog), `weight`, `units` (metric|imperial,
default metric), `stage` (kitten|adult|senior or puppy|adult|senior), `activity`
(low|normal|high), `product` (catalogue id).
