# Seams under test (proposed; no interactive user, so proceeding with these)

All seams are the six public exports of `src/pricing.mjs`. Tests call only these
functions and assert on return values / thrown `TypeError`s. No internals.

1. `toGrams(spec)` — catches unit tables, compound imperial, multipacks,
   decimal comma, unicode spaces, invalid/zero/negative input. Misses: nothing
   internal; exotic unit spellings beyond the listed ones are out of scope.
2. `pricePerKg(priceText, massSpec)` — catches currency marker rules, the
   `,`/`.` separator heuristics, dash minor units, unit prices (/kg, /lb),
   minus sign, double/no marker. Misses: locales beyond the listed markers.
3. `formatMoney(amount, currency, locale)` — catches half-to-even on decimal
   digits, JPY 0 minor units, per-locale layout and the NBSP/NNBSP rule, CHF
   code layout. Misses: locales other than the four listed.
4. `kcalPer100g(spec)` — catches kJ/kcal and per 100 g/kg normalisation and
   the 50..900 sanity range. Misses: nothing else specified.
5. `daysSupply(bag, daily, startISO)` — catches floor-of-days, inclusive
   counting, month/year rollover, leap-year validation, oz specs, TZ
   independence (run under TZ=Pacific/Kiritimati and America/Anchorage).
6. `compare(products)` — catches rounding rule, cross-currency ordering,
   stable ties, invalid items last with `{currency:null, perKg:NaN}`,
   non-mutation, non-array TypeError.
