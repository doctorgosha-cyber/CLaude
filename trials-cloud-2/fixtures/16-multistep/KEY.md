# 16-multistep — KEY (never give to the agent)

Skill under trial: iterate-until-verified (execute-verify loop with explicit gates and an
independent check). Vague multi-file bug whose correct fix needs FIVE interacting causes;
hardened after a plain pilot scored 23/23 on the 3-cause version.

## What the agent gets (task/)
portion-service: Node 22 ESM, no deps. `src/{api,calculator,needs,catalogue,units,format}.mjs`,
`data/catalogue.json` (12 products, 3 added 2026-10-20), `data/factors.json`, `data/README.md`,
`logs/app.log` (80 lines; the 3 ticket lines for u_2291, u_0874, u_1536 are the signal),
`test/` = 5 visible node:test cases that all PASS on the buggy code (api test only checks
grams in 50-85). README.md = ONLY the vague ticket ("cat portion way too high / one says too
low / started after the catalogue update"), keep the API shape, keep npm test green, <15 min,
no packages/network. No mention of units, ranges, spellings, stages or rounding.

## Seeded defect chain (all five needed for 1.0)
(a) DATA  catalogue.json: `ck-salmon-soft-bites` energy 3850 "kcal/100g" (per-kg value
    mislabelled). Fix: 385. Effect: portion 10x too low.
(b) CODE  catalogue.mjs normaliseProduct converts only unit === 'kcal/kg' exactly; shipped rows
    `ck-ocean-fish-dry` "kcal/kg " (trailing space) and `dg-lamb-rice-dry` "kcal per kg" stay
    4120/3560 -> 10x too low. Hidden tests also use "KCAL/KG", "kcal / kg", "kcal/100 g",
    "Kcal per 100 g", and expect "kcal/lb" to be rejected. Range guard (250-600, throw) is
    asked for only in data/README.md (PS-402) and a TODO comment in catalogue.mjs.
(c) CODE  api.mjs validates units=imperial, echoes it, but passes lb to needs.mjs as kg
    (lbToKg exists unused). 2.2^0.75 = 1.81x too high. Only pointer: the two "too high"
    ticket lines are the only cat requests with units=imperial; config log line says
    localeUnits=on.
(d) DATA+CODE  factors.json (2026-10-20) renamed stage keys and carries an `aliases` map
    (neutered_adult->neutered, growth->kitten, puppy_growth->puppy) that needs.mjs never reads;
    needs.mjs silently falls back to the adult factor for unknown stages ("Clients send a
    variety of stage labels") and api.mjs no longer validates stage. 22 log lines carry
    stage=neutered_adult incl. ticket u_0874 (imperial + neutered_adult -> 2.2x). Fix: resolve
    aliases, reject unknown stages with 400 (data/README: "reject, never guess").
(e) CODE  format.mjs roundGrams: doc comment says "round half away from zero to 1 g, no
    minimums", code rounds to 5 g scoops and clamps at 20 g (hides the 10x-too-low portions:
    ticket u_1536 saw "20 g"). Fix: Math.round-style 1 g, no clamp.

## Scoring
`node grade.mjs <run-dir>` -> hidden/run-tests.mjs: 39 behavioural tests importing the
candidate's src/ fresh; temp catalogues under <run-dir>/__grade__/ (deleted). score = passed/39.
Groups: U1-U4 unit spellings (4) | C1-C5 shipped catalogue sanity, throw guard, unknown unit (5)
| I1-I6 imperial (6) | D1-D6 stage aliases / unknown stage 400 (6) | F1-F6 rounding, incl. two
tiny-portion e2e cases (6) | E1-E9 end-to-end exact grams for 7 cats + 2 dogs incl. the three
ticket lines (9) | R1-R3 regression on visible behaviour, 400 on missing/invalid weight,
404/400 (3). Deterministic, no network, < 2 s. Grader interface unchanged from v1.

## Verified scores (v2)
- untouched task/: 0.179 (7/39); npm test 5/5 green
- reference/: 1.000 (39/39); npm test green
- only (a)+(b)+guard: 0.410 (16/39)
- only (c): 0.308 (12/39)
- (a)+(b)+(c)+guard, without (d),(e): 0.538 (21/39)
- everything except (e): 0.718 (28/39)
- everything except (d): 0.795 (31/39)
- everything except the range guard: 0.949 (37/39)
(The v1 3-cause version scored: untouched 0.39, (a)+(b) 0.70, (c) 0.57, no guard 0.91.)

## Expected plain-agent weaknesses
- Fixes the obvious catalogue causes (a)/(b), maybe (c) from the log, and declares done once
  npm test is green -> 0.41-0.54.
- Treats the needs.mjs adult fallback as intended (it has a reassuring comment) and never
  opens factors.json `aliases` -> loses D1-D6 and E3/E5.
- Never reads format.mjs (nothing in the ticket points there) -> loses F1-F6 and most E-cases,
  because every e2e expectation is exact to 1 g.
- Skips the PS-402 guard (only in data/README and a TODO) -> C3-C5.
- Fixes (b) with trim() only -> the guard then throws on its own catalogue (npm test shows it).
The skill's gate matrix / "find failures first" verifier is what should make an agent
reproduce all three ticket lines end to end and read every file the request touches.

## Files
task/ (agent copy), hidden/run-tests.mjs, grade.mjs, reference/ (verified 1.0),
gen/gen-log.mjs (regenerates task/logs/app.log from the BUGGY task/src — do not rerun after
editing task/), tools: none (Node built-ins only; scratchpad/tools2/16-multistep/VERSIONS.txt).
