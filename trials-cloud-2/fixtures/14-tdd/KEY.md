# 14-tdd — KEY (coordinator only; never copy into a run dir)

Skill under trial: `tdd` (/home/user/CLaude/trials-cloud-2/fixtures/skills/tdd.SKILL.md).
Task: write `src/pricing.mjs` (6 pure functions: toGrams, pricePerKg, formatMoney,
kcalPer100g, daysSupply, compare) from `task/README.md`. The agent gets `task/` only:
README (the spec), `package.json` (`npm test` = `node --test`), a stub `src/pricing.mjs`
whose exports throw plain `Error`, and ONE visible smoke test `test/smoke.test.mjs`.

## Grading

    node /home/user/CLaude/trials-cloud-2/fixtures/14-tdd/grade.mjs <run-dir>

Prints one JSON line `{"score","passed","total":25,"details":{tests,failed,...}}`.
`score = passed / 25`, where the 25 cases are `hidden/cases.mjs` (each case = one
named group of assertions; a case passes only if every assertion in it holds).
The grader spawns `hidden/runner.mjs <run-dir>/src/pricing.mjs` in a child process
(60 s timeout) with **TZ=Pacific/Auckland** (the README says the host may run under any
`TZ` and demands UTC calendar arithmetic). No tools needed beyond Node 22 (nothing was
installed under tools2/14-tdd; see the note file there). Deterministic; runs in ~0.3 s.
Nothing is written into the run dir (`__grade__/` is reserved and removed if present).

Expected values and their rationale are inline in `hidden/cases.mjs`. Key choices:
- Half-to-even values: 2.125 / 2.625 / 2.875 / 0.125 are exact binary halves, so only the
  tie rule distinguishes implementations (half-even → 2.12, 2.62, 2.88, 0.12; halfExpand,
  toFixed and Math.round → 2.13, 2.63, 2.88, 0.13). 2.345 / 2.355 / 1.005 / 1.015 / 0.005
  test the README rule "round the decimal digits of String(amount)": String prints
  "2.345" → 2.34, "2.355" → 2.36, "1.005" → 1.00, "1.015" → 1.02 (1.015*100 is
  101.49999999999999 in binary, so a numeric half-even gives 1.01; toFixed gives 2.35 for
  2.355). All values were cross-checked against Intl.NumberFormat roundingMode:"halfEven"
  on Node 22.22.0 (ICU), which agrees with the rule on every case.
- Locale strings: taken from Intl.NumberFormat(locale,{style:'currency',
  currencyDisplay:'narrowSymbol'}) on Node 22.22.0 and spelled out in the README table
  (so an agent can hand-roll them too). fr-FR groups with U+202F and puts U+00A0 before the
  symbol; uk-UA and de-DE use U+00A0 for both; en-US "CHF<NBSP>1,234.50". Cases F04/F05
  include fr-FR USD and uk-UA EUR, where Intl's *default* `currencyDisplay:'symbol'`
  prints "$US" / "EUR" instead of the narrow symbol the README specifies.
- Dates: 2028-02-29 reachable; 2100-02-28 + 2 days = 2100-03-01 (not a leap year);
  2000-02-29 (leap); 366 days from 2027-03-01 = 2028-02-29; 2027-02-29 is invalid input
  (JS `new Date` would silently roll it to Mar 1); "2028-02-27T00:00:00Z" rejected (strict
  format). Under TZ=Pacific/Auckland a mixed local/UTC implementation is off by one day.
- kJ trap: "1500 kJ/kg" is 35.85 kcal/100 g (below 50) → must throw; an implementation
  that range-checks before normalising accepts it. "14640 kJ/kg" must be accepted.
- Ties: C01/C02 use prices and masses whose perKg are exactly 10 in floating point
  (10/1, 5/0.5, 20/2, 2.5/0.25, 40/4, 1/0.1 → check: 1/0.1 === 10 is true in IEEE double).
  C03 expects unparseable items (including undefined/missing fields) last in input order
  with `{currency:null, perKg:NaN}` and no input mutation; `(a,b)=>a.perKg-b.perKg` fails it.

## Verification record (Node 22.22.0, 2026-10-29)

| run dir | score | failed |
|---|---|---|
| untouched `task/` (stub) | 0/25 = 0.00 | all |
| `reference/` | 25/25 = 1.00 | – |
| reference, rounding delegated to Intl default (halfExpand) | 20/25 = 0.80 | F01 F02 F03 F04 F05 |
| reference, `amount.toFixed(n)` rounding | 20/25 = 0.80 | F01–F05 |
| reference, numeric half-even on `amount*100` | 24/25 = 0.96 | F01 (1.015) |
| reference, `new Date(y,m,d)` local + toISOString (graded under Pacific/Auckland) | 23/25 = 0.92 | D01 D02 |
| reference, kcal range checked before kJ/kg normalisation | 23/25 = 0.92 | K01 K02 |
| reference, comparator `a.perKg - b.perKg` | 24/25 = 0.96 | C03 |
| reference with Intl `roundingMode:'halfEven'` instead of the string rounder (control) | 25/25 | – |

The degraded variants live in the scratchpad (`…/scratchpad/14-degrade/<name>/src/pricing.mjs`),
not in the fixture.

## Calibration (plain one-shot attempts)

See the section at the end (filled after the calibration runs).

## Expected plain-agent weaknesses (what the hidden set punishes)

1. Rounding: using `toFixed`, `Math.round(x*100)/100`, or `Intl` with its default
   halfExpand → loses F01–F05 (5 cases = 20 %). Numeric half-even loses F01 (1.015).
2. Symbol display: Intl default `currencyDisplay:'symbol'` → "$US", "EUR" in fr-FR/uk-UA
   (F04, F05); hand-rolled layouts with U+0020 instead of U+00A0/U+202F.
3. Price parsing: lone-separator rule (`¥1,200`, `€1.299`), dash-for-cents keeping the decimal
   mark (`1.250,— CHF`), code before the number (`USD 12.50`), two markers → TypeError.
4. Mass parsing: count prefix on a compound mass (`2 × 1 lb 4 oz`), parenthetical on a
   compound, NBSP/NNBSP inside the spec, `500` without a unit and `500 ml` must throw.
5. kJ/kg sanity-range order; dates: invalid calendar date, strict format, TZ mixing.
6. Error contract: TypeError (not Error/RangeError) with the input text in the message.
7. compare: NaN last in input order, stability, no mutation, array-likes rejected.

## How the TDD skill is expected to help

The skill forces red→green per seam, so the agent writes tests at exactly these public
functions, from the spec's stated rules (half-even, JPY, NBSP, inclusive days, NaN-last),
which should surface the rounding-mode and locale mistakes before "done". It also pushes
the agent to ask the user to confirm seams — in the trial the prompt says there is no
user, so watch for agents that stall on the "confirm seams" step (log it as cost).
