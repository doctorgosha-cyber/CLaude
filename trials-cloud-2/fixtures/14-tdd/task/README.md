# pricing.mjs — units & price helpers for the comparison tables

Deliver `src/pricing.mjs` (ES module, Node 22, no dependencies) exporting the six
functions below. The file currently contains stubs that throw. `npm test` runs
`node --test` (one smoke test is in `test/`; add your own tests there if you like).

Constraints: work only inside this folder; do not install packages or use the
network; do not git commit. Aim for under 15 minutes of work. The module must be
pure: no I/O, no globals, same output on any host time zone. The host may run it
under any `TZ`.

## Common rules (apply everywhere)

- **Errors.** Every invalid input raises a `TypeError` whose message is non-empty
  and includes the offending input as text (e.g. `toGrams("0 g")` throws
  `TypeError` with a message containing `0 g`). Invalid means: wrong type,
  unparseable, zero, negative, non-finite, out of range.
- **Whitespace.** Trim input. Anywhere a space may appear, any Unicode space
  (U+0020, U+00A0 NBSP, U+202F NNBSP, U+2009) is accepted, and it is optional
  between a number and a unit/symbol.
- **Numbers inside mass and energy specs** use `.` or `,` as the decimal mark
  and never carry a thousands separator. Price texts have their own rule below.
- **Rounding** happens only in `formatMoney`. Everything else returns full
  precision Numbers.

## `toGrams(spec: string): number`

Total mass in grams.

- Units (case-insensitive): `g`, `gram(s)`, `kg`, `kilogram(s)`, `oz`,
  `ounce(s)`, `lb`, `lbs`, `pound(s)`. `1 oz = 28.349523125 g`,
  `1 lb = 453.59237 g`, `1 kg = 1000 g`.
- Compound imperial: `"1 lb 4 oz"` = 1 lb + 4 oz.
- Multipacks: a leading count `N ×` or `N x` (`×` U+00D7 or the letter x/X),
  or a trailing parenthetical `(N <word>)` such as `(2 bags)`, `(12 pouches)`,
  multiplies the mass. A spec never has both.
- Result must be > 0.

## `pricePerKg(priceText: string, massSpec: string): { currency, perKg }`

`perKg = amount / (toGrams(massSpec) / 1000)`, unrounded.

- Currency: exactly one marker, before or after the number, optional space:
  symbols `$`→USD, `€`→EUR, `£`→GBP, `¥`→JPY, `₴`→UAH, or ISO codes
  `USD EUR GBP JPY CHF UAH` (case-insensitive). No marker, two markers, or any
  other marker → TypeError. `currency` is the ISO code.
- Amount digits may be grouped by spaces (any Unicode space), `,` or `.`:
  - If both `,` and `.` appear, the last one is the decimal mark, the other is a
    thousands separator (`1,299.00` and `1.299,00` are both 1299).
  - If only one of `,` `.` appears, it is a thousands separator when it occurs
    more than once or is followed by exactly three digits (`1,299` = 1299,
    `¥1,200` = 1200); otherwise it is the decimal mark (`29,99` = 29.99,
    `12.5` = 12.5).
  - A dash after the decimal mark means zero minor units: `CHF 12.–` (also
    `12.-`, `12,—`) = 12.00.
- Amount must be > 0; a minus sign anywhere → TypeError.

## `formatMoney(amount: number, currency: string, locale: string): string`

- `amount` is a finite Number ≥ 0; `currency` one of the six ISO codes above;
  `locale` one of `en-US`, `de-DE`, `fr-FR`, `uk-UA`.
- Round to the currency's minor units (2 decimals; **JPY has 0**) using
  **round half to even** applied to the decimal digits of the shortest
  round-trip representation of `amount` (what `String(amount)` prints), not to
  the binary value: `2.125 → 2.12`, `2.135 → 2.14`, `1.005 → 1.00`.
- Layout: the `narrowSymbol` of the currency (`$ € £ ¥ ₴`; CHF has none and
  shows its code `CHF`), placed by locale:

  | locale | group | decimal | layout |
  |--------|-------|---------|--------|
  | en-US  | `,`   | `.`     | `$1,234.56` (symbol directly before; a code is followed by NBSP: `CHF 1,234.56`) |
  | de-DE  | `.`   | `,`     | `1.234,56 €` |
  | fr-FR  | U+202F | `,`    | `1 234,56 €` |
  | uk-UA  | U+00A0 | `,`    | `1 234,56 ₴` |

- **Non-breaking space rule:** the output never contains U+0020. Every space is
  U+00A0, except the fr-FR digit-group separator, which is U+202F.
  (This is exactly what `Intl.NumberFormat` produces for these locales with
  `currencyDisplay: "narrowSymbol"`, except for the rounding mode.)

## `kcalPer100g(spec: string): number`

Energy density normalised to kcal per 100 g.

- Accepted: `<number> kcal|kJ per|/ 100 g|100g|kg` (case-insensitive units,
  e.g. `350 kcal/100 g`, `3500 kcal/kg`, `1464 kJ/100 g`, `14.6 kJ per kg`).
- `1 kcal = 4.184 kJ`.
- Sanity range: the **normalised result** must be within 50 … 900 kcal/100 g
  inclusive; otherwise TypeError.

## `daysSupply(bagGrams: number, dailyGrams: number, startISO: string): string`

- The bag lasts `floor(bagGrams / dailyGrams)` whole days; a partial day does
  not count; fewer than one whole day → TypeError.
- Counting is inclusive: `startISO` is day 1. Return the calendar date of the
  last day as `YYYY-MM-DD`.
- `startISO` must be exactly `YYYY-MM-DD` and a real calendar date (Gregorian
  leap rules; `2027-02-29` is invalid) → otherwise TypeError. Use calendar
  (UTC) arithmetic; the result must not depend on the host time zone.

## `compare(products): Array<{ id, currency, perKg }>`

- Input: array of `{ id, price, mass }` (`price` and `mass` are strings as
  above). Not an array → TypeError. The input array and its items are not
  mutated.
- Output: a new array sorted by `perKg` ascending regardless of currency (no
  conversion). Items with equal `perKg` keep their input order. Items whose
  price or mass is invalid are **not** errors: they come last, in input order,
  as `{ id, currency: null, perKg: NaN }`.

## Examples

```js
toGrams("1.2 kg")                               // 1200
toGrams("2 × 400 g")                            // 800
pricePerKg("$29.99", "400 g")                   // { currency: "USD", perKg: 74.975 }
formatMoney(1234.5, "EUR", "de-DE")             // "1.234,50 €"   (U+00A0 before €)
kcalPer100g("3500 kcal/kg")                     // 350
daysSupply(900, 300, "2026-01-30")              // "2026-02-01"   (30, 31, 1 = three days)
compare([{ id: "a", price: "€10", mass: "500 g" }, { id: "b", price: "$9", mass: "1 kg" }])
// [ { id: "b", currency: "USD", perKg: 9 }, { id: "a", currency: "EUR", perKg: 20 } ]
```
