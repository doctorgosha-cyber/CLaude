# 16-multistep — KEY (never give to the agent)

Skill under trial: iterate-until-verified (execute-verify loop with explicit gates and an
independent check). The task is a vague multi-file bug whose fix needs three interacting
causes; a one-pass agent that stops at the first plausible cause scores ~0.5-0.7.

## What the agent gets (task/)
portion-service: Node 22 ESM, no deps. `src/{api,calculator,needs,catalogue,units,format}.mjs`,
`data/catalogue.json` (12 products, 3 added 2026-10-20), `data/factors.json`, `logs/app.log`
(80 lines; signal = the 3 lines for users u_2291, u_0874, u_1536 named in the README),
`test/` = 4 visible node:test cases that all PASS on the buggy code. README = vague ticket
("portion for my cat is way too high / one says too low / started after the catalogue update"),
plus three explicit asks: fix properly, loader must throw when any product is outside
250-600 kcal/100 g after normalisation, loader must tolerate the supplier's unit spellings.

## Seeded defect chain (all three needed)
(a) DATA  data/catalogue.json: `ck-salmon-soft-bites` has energy 3850 "kcal/100g" (per-kg value
    mislabelled per 100 g). Fix: 385 kcal/100g (or 3850 kcal/kg). Effect: portions 10x too low.
(b) CODE  src/catalogue.mjs normaliseProduct: converts only when unit === 'kcal/kg' exactly.
    Shipped rows `ck-ocean-fish-dry` = "kcal/kg " (trailing space) and `dg-lamb-rice-dry` =
    "kcal per kg" are not converted -> 4120 / 3560 kcal/100g -> portions 10x too low.
    Fix: canonicalise units (trim, case, whitespace, "per" alias); hidden tests also use
    "KCAL/KG", "kcal / kg", "kcal/100 g", "Kcal per 100 g".
(c) CODE  src/api.mjs handlePortion: validates `units` (metric|imperial), echoes it in the body,
    but passes the raw weight to needs.mjs as kg. `lbToKg` exists unused in src/units.mjs.
    For imperial users (lb) the kcal need is 2.2^0.75 = 1.81x too high -> "way too high".
    Log: the two "too high" tickets (u_2291, u_0874) are the only cat lines with units=imperial;
    u_1536 ("too low") is a metric user of ck-ocean-fish-dry (grams=6).
Plus the explicit new requirement: loader throws outside 250-600 kcal/100 g (tests C3, C4).

## Scoring
`node grade.mjs <run-dir>` runs hidden/run-tests.mjs (23 behavioural tests, each imports the
candidate's src/ fresh; temp catalogues under <run-dir>/__grade__/, deleted after).
score = passed / 23. Groups: U1-U4 unit spellings (4), C1-C4 shipped catalogue sanity + throw
guard (4), I1-I6 imperial path (6), E1-E6 end-to-end grams for 4 cats + 2 dogs (6, ±1 g and
±0.5 % kcal), R1-R3 regression on the visible behaviour + 400 on missing/invalid weight +
404/400 (3). Deterministic, no network, < 2 s.

## Verified scores
- untouched task/: 0.391 (9/23)
- reference/: 1.000 (23/23); `npm test` green in both
- degraded: (a)+(b)+guard but no imperial fix: 0.696 (16/23) | (c) only: 0.565 (13/23) |
  all three but no throw guard: 0.913 (21/23) | (a)+(c)+guard, (b) fixed by trim() only: 0.273
  (the guard then throws on the agent's own catalogue; its own `npm test` would show this) |
  (b)+(c)+guard without the data fix: 0.364 (same reason).

## Expected plain-agent weaknesses
- Finds (a) (3850 is visible) and often (b) via the guard, but never checks the imperial path:
  the log line is the only pointer, the response body looks "handled" (units echoed), and the
  visible tests are all metric -> 0.70.
- Fixes (b) with trim() only, misses "kcal per kg"/case -> C1/C2 fail or the guard throws.
- Skips the throw guard or implements it as a warning -> C3/C4 fail.
- Declares done after the 4 visible tests pass without adding an imperial or e2e check.
The skill pushes for an acceptance matrix, per-cause gates and an independent re-check of the
three ticket lines, which is exactly what surfaces (c).

## Files
task/ (agent copy), hidden/run-tests.mjs, grade.mjs, reference/ (verified 1.0),
gen/gen-log.mjs (regenerates task/logs/app.log from the BUGGY task/src — do not rerun after
editing task/), tools: none installed (Node built-ins only; see scratchpad/tools2/16-multistep/VERSIONS.txt).
