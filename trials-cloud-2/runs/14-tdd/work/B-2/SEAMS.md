# Seams under test (proposed; no interactive user, proceeding with these)

All tests go through the public exports of `src/pricing.mjs`. No internal helper is imported or tested.

1. `toGrams(spec)` — catches unit conversion, compound imperial, multipack arithmetic, Unicode-space/decimal-comma parsing, and TypeError-with-input-text. Misses: nothing about pricing.
2. `pricePerKg(priceText, massSpec)` — catches currency marker detection, grouping/decimal heuristics, dash-for-zero minor units, unit-price (`/kg`, `/lb`) passthrough, minus-sign rejection. Misses: mass parsing edge cases (covered by seam 1).
3. `formatMoney(amount, currency, locale)` — catches half-to-even on decimal digits, JPY 0 minor units, per-locale layout and NBSP/NNBSP rule. Misses: locales/currencies outside the allowed set beyond the TypeError check.
4. `kcalPer100g(spec)` — catches kJ→kcal and per-kg→per-100g normalisation and the 50…900 sanity range on the normalised value. Misses: exotic spellings not in spec.
5. `daysSupply(bag, daily, startISO)` — catches floor(days), inclusive counting, UTC calendar arithmetic across month/year/leap boundaries, strict date validation. Misses: TZ independence is asserted only by running under a fixed odd TZ in CI-less setup (we run tests once under TZ=Pacific/Kiritimati and once under TZ=America/Anchorage by hand).
6. `compare(products)` — catches rounding-before-sort, stable ordering on ties, invalid rows sinking to the end with `{currency:null, perKg:NaN}`, non-mutation. Misses: nothing extra; delegates to seams 2 and 3.
