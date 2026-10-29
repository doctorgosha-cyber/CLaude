# 16-multistep — KEY v3 (never give to the agent)

Skill under trial: iterate-until-verified. Vague multi-file bug; the complete fix needs six
code/data causes PLUS four product-spec rules that live in docs/PORTION-SPEC.md, which the
ticket never mentions (README only says "docs/ — the product spec lives here"). v3 after plain
pilots scored 1.0 on v1 (3 causes) and v2 (5 causes, hints in code comments/data README).

## What the agent gets (task/)
portion-service, Node 22 ESM, no deps: src/{api,calculator,needs,catalogue,units,format}.mjs,
data/catalogue.json (14 products, 4 added 2026-10-20, fields form/pack_g/suitable_for),
data/factors.json (+aliases), data/README.md (field list, points to the spec), docs/PORTION-SPEC.md
(60 lines, authoritative), logs/app.log (80 lines), test/ = 5 visible node:test cases that pass
on the buggy code (api test only checks grams 50-85; format test only checks kcal rounding and
that grams is a number). README = the vague ticket, four complaining accounts (u_2291, u_0874,
u_1536, u_3078), keep API names, npm test green, <15 min, no packages/network.

## Seeded causes
(a) DATA  ck-salmon-soft-bites 3850 "kcal/100g" (semi-moist) -> should be 385. 10x too low.
(b) CODE  catalogue.mjs converts only unit === 'kcal/kg'; rows "kcal/kg " and "kcal per kg"
    stay 4120/3560. Spec §3 says spellings vary. Tests also use KCAL/KG, "kcal / kg",
    "kcal/100 g", "Kcal per 100 g"; "kcal/lb" must be rejected.
(c) CODE  api.mjs accepts units=imperial but passes lb as kg (lbToKg unused). 1.81x too high.
    Only pointers: the two "too high" ticket lines carry units=imperial; spec §1.
(d) DATA+CODE  factors.json aliases (neutered_adult->neutered, growth->kitten,
    puppy_growth->puppy) ignored; needs.mjs silently uses the adult factor for unknown stages,
    api.mjs does not validate stage. 20+ log lines carry neutered_adult incl. ticket u_0874.
    Spec §1: resolve aliases, 400 on unknown stage.
(e) CODE  format.mjs roundGrams: comment says 1 g half-away-from-zero, code rounds to 5 g
    scoops with a 20 g floor (hides the 10x-too-low portions: ticket u_1536 saw "20 g"). Spec §8.
(f) DATA->CODE  dg-beef-stew-wet declares 390 "kcal/can" with pack_g 400; the loader treats it
    as 390 kcal/100 g (inside the dry range, so a form-blind 250-600 guard does not catch it).
    Spec §3: value / pack_g x 100 = 97.5; pack_g mandatory for per-pack units.
Spec-only rules (nothing in src/ implements or mentions them):
(g) §5 safety cap: cat 2.5 % / dog 3 % of kg body weight per day, dry & semi-moist only, growth
    stages exempt, compare before rounding, `capped` always present. Uses kg (imperial trap, K6).
(h) §6 meals: growth stages 3, others 2; `meals`, `perMeal` = round(rounded grams / meals).
(i) §7 wet food: `cans` = grams / pack_g to 1 decimal; absent for dry.
(j) §3 PS-402 plausibility guard by form: dry/semi-moist 250-600, wet 60-150 kcal/100 g; loader
    refuses the catalogue. (A form-blind 250-600 guard throws on the shipped wet pate, 92 kcal:
    the agent's own npm test then fails, forcing a read of the spec.)
Red herring: ticket u_3078 = adult dog (24 kg) on dg-senior-light (suitable_for: ["senior"]),
served correctly (377 g). Spec §3: suitable_for is a shop label. A "fix" that applies the
product's stage factor or rejects the mismatch fails H1/H2 (and K2/E3 collaterally).

## Scoring
`node grade.mjs <run-dir>` -> hidden/run-tests.mjs: 60 behavioural tests importing the
candidate's src/ fresh; temp catalogues under <run-dir>/__grade__/ (deleted). score = passed/60.
Groups: U1-U4 spellings | C1-C9 catalogue sanity, guard by form, per-can energy | I1-I6 imperial
| D1-D6 stage aliases / 400 | F1-F6 rounding | M1-M5 meals | K1-K6 cap | W1-W4 wet cans |
H1-H2 red herring | E1-E9 end-to-end exact grams (the three real ticket lines included) |
R1-R3 regression, 400s, response shape. Deterministic, no network, < 2 s. Grader interface
unchanged since v1.

## Verified scores (v3)
- untouched task/: 0.133 (8/60); npm test 5/5
- reference/: 1.000 (60/60); npm test 5/5
- only the five v2 causes (a-e), lenient normaliser (unknown units pass as per 100 g), no
  guard: 0.600 (36/60); npm test green. This is the realistic "fixed everything the code shows"
  state: every remaining failure comes from the spec (C-guard/per-can, M, K, W, H2, R1 shape).
- same but with a strict normaliser or a form-blind 250-600 guard: 0.25-0.28 (15-17/60), because
  the shipped catalogue (kcal/can row, 92 kcal wet pate) no longer loads; the agent's own npm
  test shows 2 failures, forcing a read of the spec.
- (a)+(b)+(c) only: 0.167 (10/60)
- everything except the spec items (g)(h)(i): 0.733 (44/60)
- everything plus the red-herring "fix" (product stage factor): 0.933 (56/60), fails H1 H2 K2 E3
- v2 history: untouched 0.18, (a)+(b) 0.41, (c) 0.31, (a)+(b)+(c) 0.54, no (e) 0.72, no (d) 0.79.

## Expected plain-agent weaknesses
- Never opens docs/PORTION-SPEC.md (ticket does not mention it) -> loses M/K/W/H and C6-C9,
  capped at ~0.6 even with all six code/data causes fixed.
- Adds a form-blind 250-600 guard -> own tests fail on the wet pate; may then "fix" the pate's
  energy instead of reading the spec.
- Treats the needs.mjs adult fallback as intended; never reads factors.json aliases.
- "Fixes" ticket u_3078 by applying the senior factor (H1/H2/K2/E3 fail).
- Declares done when the visible 5 tests pass without reproducing the ticket lines end to end.
The skill's gate matrix / "find failures first" verifier is what should drive reading every
file the request touches, including the spec, and reproducing all four ticket lines.

## Files
task/ (agent copy), hidden/run-tests.mjs, grade.mjs, reference/ (verified 1.0, implements the
whole spec), gen/gen-log.mjs (regenerates task/logs/app.log from the BUGGY task/src; do not rerun
after editing task/), tools: none (Node built-ins only; scratchpad/tools2/16-multistep/VERSIONS.txt).
