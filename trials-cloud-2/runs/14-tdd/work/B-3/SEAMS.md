# Seams under test (proposed; no interactive user, so proceeding with these)

All seams are the six public exports of `src/pricing.mjs`. Tests call them
with string/number inputs and assert on return values or thrown TypeError
(message contains the offending input). No internals are tested.

1. `toGrams(spec)` — catches unit tables, compound imperial, multipack forms,
   decimal comma, Unicode spaces, error contract. Misses: nothing it does not
   export; exotic whitespace variants beyond the four listed.
2. `pricePerKg(priceText, massSpec)` — catches currency marker rules, amount
   grouping/decimal inference, dash-for-zero-minor, unit-price (/kg, /lb)
   forms, minus rejection. Misses: locales not in spec.
3. `formatMoney(amount, currency, locale)` — catches half-to-even on decimal
   digits, JPY 0 minor units, per-locale separators and symbol placement, NBSP
   rule. Misses: amounts whose String() form is exponential (spec silent).
4. `kcalPer100g(spec)` — catches kcal/kJ conversion, /100 g vs /kg, range
   check on the normalised result. Misses: other energy units (not in spec).
5. `daysSupply(bag, daily, startISO)` — catches floor-day arithmetic,
   inclusive counting across month/year/leap boundaries, strict ISO date
   validation, TZ independence (tests run under several TZ values).
6. `compare(products)` — catches rounding per currency, stable sort,
   invalid-item placement, non-mutation, non-array TypeError.
