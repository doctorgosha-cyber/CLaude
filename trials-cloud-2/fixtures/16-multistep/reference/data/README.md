# data/

## catalogue.json
Supplier feed export, hand-edited by the catalogue team before each release. Fields:
`id`, `name`, `species`, `form` (dry | semi-moist | wet), `energy: { value, unit }` in the
feed's own spelling, `pack_g` (net weight of one can or pouch, wet products), `suitable_for`
(shop filter labels), `added`. What the loader must do with these is in docs/PORTION-SPEC.md.

## factors.json
`rer` — resting energy requirement coefficients (kcal = c × kg^e).
`stage` — life-stage multipliers per species. Keys were shortened in the 2026-10-20 release;
`aliases` maps the old client-facing keys to the current ones so older app builds keep
working. Unknown stage or activity keys are a client bug: reject the request, never guess.
`activity` — activity multipliers.
