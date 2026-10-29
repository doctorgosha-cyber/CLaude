# data/

## catalogue.json
Supplier feed export, hand-edited by the catalogue team before each release. Each product
declares `energy: { value, unit }` where the unit is the feed's own spelling of either
"kcal per 100 g" or "kcal per kg"; the loader normalises everything to `kcalPer100g`.
Realistic dry/semi-moist foods are 250–600 kcal per 100 g. Anything outside that range after
normalisation is a feed error: the service must refuse to load such a catalogue (ops request
PS-402) rather than quote a portion from it.

## factors.json
`rer` — resting energy requirement coefficients (kcal = c × kg^e).
`stage` — life-stage multipliers per species. Keys were shortened in the 2026-10-20 release;
`aliases` maps the old client-facing keys to the current ones so older app builds keep
working. Unknown stage or activity keys are a client bug: reject the request, never guess.
`activity` — activity multipliers.
