# Portion service — product specification (v1.4, 2026-10-20)

This is the contract between the portion service (`src/`) and the apps. Where the code and
this document disagree, this document wins; the apps are built against it.

## 1. Request (`GET /portion`)
- `species`: `cat` | `dog`.
- `weight`: body weight, a positive number. Metric locales send kilograms; imperial locales
  send pounds and add `units=imperial` (1 lb = 0.45359 kg). Anything else for `units` → 400.
- `stage`: a life-stage key from `data/factors.json` for that species, or one of the legacy
  aliases listed there (older app builds still send them). Any other value → 400; the
  service never guesses a stage.
- `activity`: `low` | `normal` | `high` (default `normal`). Unknown → 400.
- `product`: catalogue id. Unknown → 404; wrong species → 400.
- Missing or non-numeric or non-positive `weight` → 400 with an `error` message.

## 2. Energy need
`kcalPerDay = 70 × kg^0.75 × stageFactor × activityFactor`, always from the weight in kg.

## 3. Catalogue energy
Each product declares `energy.value` and `energy.unit`. The feed is hand-edited, so the unit
spelling varies (capitals, extra spaces, "per" instead of "/"); the loader must interpret:
- per 100 g ("kcal/100g", "kcal per 100 g", …): value as is;
- per kilogram ("kcal/kg", "kcal per kg", …): value ÷ 10;
- per can or pouch ("kcal/can", "kcal per pouch", …): value ÷ `pack_g` × 100; `pack_g` is
  mandatory for this form, otherwise the catalogue is rejected.
Any unit that cannot be interpreted rejects the catalogue.

Plausibility (PS-402): after normalisation, dry and semi-moist products must be 250–600 kcal
per 100 g and wet products 60–150 kcal per 100 g. A catalogue with any product outside its
range must be refused at load time; we would rather fail to start than quote nonsense.

`suitable_for` is a shop-filter label and plays no part in the calculation: a customer who
feeds an adult dog a senior food gets the adult dog's portion of that food.

## 4. Daily grams
`grams = kcalPerDay ÷ kcalPer100g × 100`.

## 5. Safety cap
A dry or semi-moist daily portion may not exceed a share of body weight:
cat 2.5 %, dog 3 % of the weight in kg, in grams per day (4 kg cat → 100 g). The cap applies
to every stage except growth (kitten, puppy and their aliases) and never to wet products.
If the unrounded grams exceed the cap, `grams` becomes the cap and the response carries
`capped: true`; otherwise `capped: false`. The field is always present.

## 6. Meals
Growth stages are fed 3 meals a day, every other stage 2. The response carries `meals`
and `perMeal` = `grams` (after cap and rounding) ÷ `meals`, rounded per section 8.

## 7. Wet food
For a wet product the response also carries `cans` = `grams` ÷ `pack_g`, rounded to one
decimal (half away from zero). Dry and semi-moist responses have no `cans`.

## 8. Rounding
`grams`, `perMeal`: whole grams, half away from zero (42.5 → 43). No scoop sizes, no
minimum portion — the apps decide how to present small numbers.
`kcalPerDay`: one decimal. `cans`: one decimal.

## 9. Response
```
{ "grams": 66, "kcalPerDay": 246.4, "weight": 4.2, "units": "metric",
  "capped": false, "meals": 2, "perMeal": 33,
  "product": { "id": "ck-chicken-dry", "name": "Chicken & Rice Dry", "kcalPer100g": 372 } }
```
plus `"cans": 1.6` for wet products. `weight` and `units` echo the request.
