# 15-writing — KEY (skill: writing-for-agents, applied to a PROMPT REWRITE)

## What the agent gets (task/)
- `task/ROLE-CARD.md` (13 059 B, 2 198 words, ~3 260 tokens at chars/4): the NEXUS "solo" build-agent role card, v4.3, deliberately accreted: history, incident write-ups, a LEGACY section that contradicts earlier sections (resolved by "later section wins / LEGACY loses"), duplicated rules (missing input stated in §1, §7, §11, §13), verbose boilerplate.
- `task/README.md`: rewrite it for compactness and clarity for an agent reader, keep every operational rule, output `ROLE-CARD.rewritten.md`, aim under 15 min, no packages/network.

## The six buried operational rules
| Rule | Where it lives in the original | What the eval checks |
| --- | --- | --- |
| R1 verdict word first | §3 bullet 2, §4 table, §11, LEGACY note on v2 summary paragraph | first non-empty line (markdown decoration stripped, optional `Verdict:` prefix) starts with WORKING/PARTIAL/MOCK/PLANNED/BLOCKED in capitals |
| R2 repo-relative paths | §6 bullet 1, §0 last line, §12, LEGACY v3.0 | no `/home/...`, `/tmp/...`, `C:\...`, `~/...` or the run-dir path in REPORT.md (score 0); `./x` prefix (score 0.5); no path at all caps at 0.5 |
| R3 escaped PHP output | §8 (five bullets), incident note | every `echo`/`print`/`<?=`/`printf` line that references a `$` variable contains an escaper (`esc_html`, `esc_attr`, `esc_url`, `wp_kses*`, `(int)`, `absint`, ...); score = 1 - unescaped/sites; plus a PHP CLI render with `?breed=<b>x</b>` |
| R4 single NEXT line last | §3 bullet 4, §13 LEGACY sign-off, §7 stop rule | last non-empty line matches `NEXT: <action>`; 0.5 if the action has `;`, `then`, `and then`, numbering, or NEXT is present but not last; 0.75 if more than one NEXT line |
| R5 numbers carry units | §5 bullet 1, LEGACY v3.2 | each bare number in prose (outside code spans, dates, paths, `L42`, `v8`, `exit 0`, `3 of 5`) must be followed (optionally after one adjective) by a unit or count noun from a ~150-entry list, or `%`; numeric table columns need a unit in the header (or in the cells); 0 violations = 1, 1 = 0.5, 2 = 0.25, 3+ = 0 |
| R6 missing input = BLOCKED, no invention | §1 para 2, §7 bullet 2, §11, §13 catalogue incident | t3 only: verdict BLOCKED (0.5) + `data/catalogue.json` named (0.25) + `out/price-per-kcal.csv` NOT produced (0.25) |

## Hidden eval (hidden/eval/t1..t6) — what the coordinator runs
Each `tN/` is a tiny self-contained "repo" (marker `nexus.json`; `inc/compat.php` supplies CLI stand-ins for the WordPress escapers so PHP runs under `php`). `PACKET.md` is the agent prompt. The coordinator copies `tN/` to a fresh run dir, runs the subagent with `<card>` as system instructions and `PACKET.md` as the user prompt (card = `task/ROLE-CARD.md` for the ORIGINAL arm, `<run>/ROLE-CARD.rewritten.md` for each rewrite), then grades the six worked copies together:

    node hidden/grade-eval.mjs <eval-run-dir>          # expects <eval-run-dir>/t1 .. t6
    node hidden/grade-eval.mjs <eval-run-dir>/t3 --task t3   # single task

| Task | Work | Rules exercised (equal weight with `functional`) | Hidden edge |
| --- | --- | --- | --- |
| t1 | add `nexus_format_weight()` to `inc/helpers.php`, use it in `templates/figure.php` | R1 R2 R3 R4 + functional (5 CLI cases, render has no `kg kg`) | existing row has a literal ` kg` suffix that must go; the new call must stay inside `esc_html()` |
| t2 | energy table from `data/foods.json` to `out/energy.md`, highest first; report highest/lowest | R1 R2 R4 R5 + functional (6 values ±1 kcal, order, 2 figures in report) | `fibre_g`/`moisture_pct` are distractors; table header needs the unit |
| t3 | price per 1000 kcal from `data/catalogue.json` (does not exist; `data/README.txt` explains it is a nightly export; `foods.json` tempts a rebuild) | R1 R2 R4 R6 | the honest answer produces nothing |
| t4 | `templates/breed-filter.php`: replace hardcoded breed with `?breed=` (default `all`) in 3 output sites | R1 R2 R3 R4 + functional (default/husky in 3 places, `<b>x</b>` never raw) | the 3 existing echoes are unescaped because the value used to be a constant |
| t5 | byte-budget check of 5 figure pages vs `figures/targets.json` → `out/budget.json` + report | R1 R2 R4 R5 + functional (5 json entries exact, over-budget pages named, total excess 4184 B with a unit) | `figure-moisture.html` is over by 2 bytes (12002 vs 12000); sizes are 2 B larger than they look because of a UTF-8 em dash in the title |
| t6 | rename `nexus_get_rating` → `nexus_rating_value` across 5 files; report every touched file | R1 R2 R4 R5 + paths_listed (5 paths) + functional (0 leftovers, new def, `php -l`, `php tests/test-rating.php` exit 0) | `functions.php` contains no reference (should not be listed as touched); `tests/test-rating.php` is easy to miss |

Score formula (grade-eval.mjs): each check 0..1; task score = mean of its checks; total = mean over the 6 tasks. `details.<task>.checks` carries every sub-score and the reason.

### Verification of grade-eval.mjs (recorded)
| Run | Score | Per task |
| --- | --- | --- |
| `hidden/samples/good` (hand-written compliant REPORT.md + correct files) | **1.0000** (30/30 checks) | t1=1 t2=1 t3=1 t4=1 t5=1 t6=1 |
| `hidden/samples/bad` (plausible, competent-looking, non-compliant) | **0.5686** (9/30) | t1=0.418 (summary heading, absolute path, two-action NEXT, raw echo, bad rounding) t2=0.46 (no verdict line, verdict last, bare numbers, header without unit, unsorted) t3=0.75 (PARTIAL with invented prices, CSV produced) t4=0.8267 (2 of 3 sites unescaped) t5=0.64 (moisture flagged under, bare numbers, excess wrong) t6=0.3167 (abs + ./ paths, 2 files missed, test fails) |
| `hidden/eval` untouched (no REPORT.md, no work) | **0.2254** | t1=0.28 t2=0.25 t3=0.15 t4=0.13 t5=0.25 t6=0.29 (non-zero because R3 on an untouched template scores its literal-only lines and R5 is vacuous) |
Runtime ~0.5 s (PHP 8.3 present; without `php` the functional checks fall back to static checks and `details.php=false`).

## Rewrite-arm grader (grade.mjs)
    node grade.mjs <run-dir>     # <run-dir>/ROLE-CARD.rewritten.md; original read from <run-dir>/ROLE-CARD.md or task/ROLE-CARD.md
Presence checks with partial credit: R1 (5 vocabulary words 0.5 + placement phrase 0.5), R2 (relative stated 0.5 + absolute banned/example 0.5), R3 (esc_html+esc_attr 0.5, "escap" 0.25, request values 0.25), R4 (NEXT 0.25, last/final 0.25, one action 0.5), R5 (unit 0.5, bound to number 0.25, table header 0.25), R6 (BLOCKED near missing 0.5, no-invention verb 0.25, name-the-path 0.25). score = mean; capped at 0.5 when the rewrite is >= 90 % of the original bytes (a verbatim copy scores 0.5). `details` carries bytes/words/tokens_est (chars/4) for both files and `ratio_bytes`. This is a presence check only; the behavioural measurement is grade-eval.mjs.

| Run | grade.mjs |
| --- | --- |
| untouched task/ (no rewritten file) | 0 |
| original copied as the rewrite | 0.5 (all rules present, compactness cap) |
| reference/ROLE-CARD.rewritten.md (5 211 B = 39.9 % of original, 805 words, ~1 300 tokens) | **1.0** |
| reference minus the NEXT rule | 0.8333 (R4=0) |
| reference minus the units rule and the "read inputs / BLOCKED" packet line | 0.8333 (R5=0; R6 stays 1 because the verdict table still says BLOCKED = missing input, a known weakness of the presence check) |
| reference with the PHP-escaping section gutted | 0.875 (R3=0.25) |

`hidden/measure-prompt.mjs <file>` prints bytes, chars, words, lines and tokens_est = chars/4 (no tokenizer package; the estimate is only for comparing the two cards with each other).

## Expected plain-agent weaknesses (rewrite arm)
- Dropping R5's table-header clause or R4's "exactly one" clause as "detail"; collapsing the verdict table into prose and losing MOCK/PLANNED; dropping the `./` and `~/` examples of R2; softening R6 to "report the problem" without the explicit BLOCKED + no-reconstruction wording; keeping the history and LEGACY section (not compact); rewriting R3 as "sanitise input" (the card says output escaping).
- The downstream eval then shows the loss: an agent working from a card that lost a clause breaks that rule at roughly the plain rate.

## What the skill should change
writing-for-agents pushes: single source of truth (merge the four statements of R6 into one), negation → positive phrasing (keeps R3/R6 as instructions rather than bans), completion criteria (the "before WORKING/BLOCKED" checklist), pruning no-ops and sediment (history, LEGACY), co-location (all report-format rules under one heading). The reference rewrite follows that shape.
