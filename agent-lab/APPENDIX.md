# AGENT-LAB appendix — evidence per question

All paths are inside `agent-lab-package.zip`. "Computed" = arithmetic on package numbers. "Estimate" = my judgement, to be verified with the measurement named next to it.

## §1 Token / time waste

### Where the tokens are (computed)
| Bucket | Tokens | Source |
|---|---|---|
| OFFICE-2 build (RUN-030), 13 agent runs | 3,995,179 (vulcan 3,341,697 = 84 %, sanguinius 354,114, dorn 299,368); 6.6 h agent wall time | `learning/runs/RUN-030-OFFICE-2-CLAUDE/telemetry.json:5-17` |
| Learning gates measured in the package | ≈ 4.42 M | CM-SOLO ≈ 1.09 M (`CM-SOLO-V1/RESULT.md:24`), CM-CORAX 466 K (`CM-CORAX-V1/RESULT.md:20`), CM-DORN 531 K (`CM-DORN-V1/RESULT.md:21`), RUN-013 ≈ 261 K, RUN-014 ≈ 275 K, RUN-015 ≈ 1.41 M (sum of `per_rep_tokens` in `RUN-015-SEO-FIELD/{before,after}.json`), RUN-023 ≈ 389 K |
| Blind graders (Fable) | 195 K (RUN-029, 36 % of the run's 535 K), 314 K (RUN-028) | `RUN-029-BINANCE-BOT/telemetry.json:59-67`, `RUN-028-CAT-TRADING/RESULT.md:3` |
| Agent prompt files | 862–2,858 chars each (≈ 0.2–0.7 K tokens) | file sizes of `.claude/agents/*.md` |

**Not a waste lever (no change needed):** agent prompt length and packet size. Prompts are ≈ 0.2–0.7 K tokens. A lean packet is 1.2–1.8 K tokens (`SYSTEM.md:32`). A typical task costs 35–490 K, so the prompt and packet are under 2 %. Councils and JEV are already gone (`CLAUDE.md:11`, `SYSTEM.md:23`).

### Waste mechanisms, with evidence and estimated saving
1. **Monolithic builder sessions.**
   - Evidence: 9 vulcan tasks in RUN-030 cost 200–490 K each, against the cost model's ≤ 60 K per worker (`CLAUDEMAXING-LOOP.md:60`).
   - The reports show why. A-FINAL re-shot all 54 targets and ran Blender 6 times (`reports/OFFICE-2-A-FINAL.md:12,74`). A-POLISH ran 2 h 30 min (`OFFICE-2-A-POLISH.md:85`). A-WALK and A-PRODUCT were cut by the weekly rate limit and resumed (`OFFICE-2-A-WALK.md:4,42`, `OFFICE-2-A-PRODUCT.md:53`). SHOTS retook 5 shot groups (`OFFICE-2-SHOTS.md:16-21`).
   - Fix: AL-05 (budget, PROGRESS.md checkpoint, one acceptance group per agent) and AL-04 (fresh agent per round).
   - Saving: estimate 20–40 % of builder tokens, because a fresh agent no longer carries old screenshots and tool output. Measure with AL-01 telemetry on the next comparable build.
2. **Resumed fix rounds.**
   - Evidence: the RUN-028 Vulcan R2 figure is 245 K, "cumulative-context figure, increment … unknown (≥ 38,570)" (`RUN-028-CAT-TRADING/telemetry.json:7`). Per the Claude Code docs, a resumed subagent keeps its full history.
   - Saving: estimate 30–80 % per fix round. The range is the gap between the reported 245 K and the known increment of ≥ 38.6 K. Fix: AL-04.
3. **QA re-doing the author's work, and QA on a moving tree.**
   - Evidence: dorn spent 280 K on OFFICE-2-QA (`OFFICE-2-QA.md:76`) and 230 K on QA2 (`OFFICE-2-QA2.md:36`). QA2 re-ran the author suites (`:22`) while a 4th round was still editing the tree (`:7-11`).
   - The value is real but uneven. QA found 1 major per pass on OFFICE-2 and 2 majors in RUN-028 (`RUN-028/RESULT.md:15`), but changed no score in RUN-029 (`RUN-029/RESULT.md:12`).
   - Saving: estimate 30–50 % of QA tokens with risk-scoped QA, re-use of the author's suite outputs, and a pinned tree. Fix: AL-06.
4. **Gates at the ceiling (computed).**
   - RUN-014 (both arms 42/42) cost ≈ 275 K. RUN-023 (both 48/48) cost ≈ 389 K. Together that is ≈ 664 K, ≈ 15 % of the measured gate spend, with an outcome that was knowable after one baseline rep.
   - A 1-rep pre-check costs ≈ 1/6 of a 2-arm × 3-rep gate, so it saves ≈ 83 % of each doomed gate. Fix: AL-02.
5. **Grader cost.**
   - Evidence: Fable used 195 K in RUN-029, more than either build (73–83 K). Hidden tests could not separate the arms: all three were 26/26.
   - The grader cannot be dropped, because it was the only discriminator. It can get pre-captured test and CLI outputs instead of re-running everything, following the "shared evidence captured once" rule (`SYSTEM.md:38`).
   - Saving: estimate 20–30 % of grader tokens. This rides on AL-01 (measure) and AL-10 (more hidden-test-discriminating build cases). No separate proposal.
6. **Check artifacts inside deliverables.**
   - Evidence: the variant folders reached 35 MB and 28.8 MB from `_check` screenshots (`OFFICE-2-QA.md:64`), which led to a rework item (D9, `OFFICE-2-QA-FIX.md:13`). Lesson recorded at `RUN-030 telemetry.json:22`.
   - This happened once, so by your own rule it should become a **check** (`checks/shipped_bug-check-artifacts-in-deliverable.mjs`: fail if any deliverable folder contains `_check/` or is above the size cap), not prompt text.

## §2 Routing
**Audit classes: solo is the right default.** The same frozen keys and cases were run 3 reps per arm, with scripted grading (`learning/eval/REG-*.json`):

| Case | solo base | corax base | dorn base | solo now (CM-SOLO-V1 applied) |
|---|---|---|---|---|
| cm-01 cross-file WP | 8/8, sev 54.2 %, 44.9 K | 8/8, 45.8 %, 43.1 K | 8/8, 37.5 %, 45.3 K | 8/8, 70.8 %, 49.4 K |
| cm-02 false-claim pressure | 9/10, 37.0 %, 36.6 K | 9.67/10, 44.8 %, 34.3 K | — | 10/10, 33.3 %, 38.7 K |
| cm-03 design/mobile/a11y | 9.33/10, 74.8 %, 43.8 K | — | 9/10, 65.3 %, 40.6 K | 10/10, 70.0 %, 48.0 K |

None of this is in `learning/routing.json`, which has only RUN-026/028/029 build and spec observations at n=1 each. Recording it costs 0 tokens (AL-07).

**Where the evidence is too thin, and the minimal deciding experiment:**
- **engineering-build:** vulcan 40/40 vs solo 38/40 with fewer tokens (73 K vs 83 K), but that is 1 case and 1 rep (`RUN-029/RESULT.md:7-17`).
  - Experiment: `regress prepare eb-v --cases=billing-module --role=vulcan --reps=3`, the same with `--role=solo`, then `grade-build` on the hidden tests, plus one new below-ceiling build case with hidden tests.
  - Decision rule: vulcan becomes the build default only if it wins on both cases. If the solo+build-rules candidate (AL-11) ties vulcan, keep the single default.
- **design-build:** the team scored +2/40 for 3.1–4.3× the tokens (`RUN-028/RESULT.md:7-14`). This is confounded: only the team had QA.
  - Experiment, already named in `RUN-028/RESULT.md:18`: solo+dorn vs a sanguinius spec + solo build, on one held-out art task, 3 reps.
- **seo-only:** corax beat solo on cm-02 by 0.67 recall points and 7.8 severity points, inside rep noise.
  - Experiment: solo vs corax on `seo-trailshoes` and `seo-descale` (they are already in the eval set), 2 reps each. These cases have no detectors, so they need the blind grader brief.
- **design-spec:** a tie, 38 vs 38 (`RUN-026/RESULT.json`). No experiment is worth its cost until the design-build question is settled.

**QA as a pipeline stage:** keep it for builds and production writes. It caught real defects in RUN-028, OFFICE-1 (`OFFICE-1/telemetry.json:6`), OFFICE-2 and RUN-026 (`qa-dorn.json`: it refuted 2 builder claims). Scope it per AL-06.

## §3 Agent prompts (diffs in the proposal files)
| File | Contradiction / gap | Proposal |
|---|---|---|
| `solo.md` | Line 8 "V0.4" vs `SYSTEM.md:1` V0.5. Lines 9–10 carry history numbers that will go stale. Line 18 names LIMITATION, but the lean format has NOT CHECKED (`SYSTEM.md:32`). No stop rule. No build rules, although solo builds in RUN-028/029. | AL-11 |
| `vulcan.md` | Line 14 uses DEMO/MOCK/LIVE vs `CLAUDE.md:19` WORKING/PARTIAL/MOCK/PLANNED/BLOCKED; reports mix both (`QA-FIX.md:10` WORKING, `QA2-FIX.md:12` DEMO). No budget or checkpoint. No rule for edits outside `writes` (`A-WALK.md:35` edited shared files). No atomic-landing rule: this failed twice (`QA2.md:7-11`, `QA2-FIX.md:4`). | AL-05 |
| `dorn.md` | Line 14 verdicts vs reports using "PASS-WITH-NOTES" (`OFFICE-2-QA.md:4`, `OFFICE-1 telemetry:6`). Line 9 is a history line. No scope limit, no pinned-tree rule, no stop rule. | AL-06 |
| `corax.md` | Line 14 says "that is KHAN", but khan is not spawnable (`SYSTEM.md:44`). No output contract. Rules: **no change needed**; 6 gated rule bundles were rejected (ledger 5–8, 12–13). | AL-12 |
| `sanguinius.md` | No output contract or priority scheme, although its best output was a prioritised 25-item list (`RUN-030 telemetry:20`, `A-FINAL.md` P1/P2/P3). No reuse of NEXUS captures. | AL-13 |
| `skills/shared/evidence-report/SKILL.md` | Lines 9–24 prescribe the full V0.2 format, while `SYSTEM.md:32` makes lean the only default. Every packet loads both. | AL-09 |

## §4 Is CAWL statistically sound?
- **Sound:** blind or scripted grading, sealed keys, held-out cases, a ledger with reasons, refusal of hand grading (`scripts/learn.mjs:26-31`), and paired agreement across cases (`paired_agree`, ledger 9–15).
- **Reps measure run noise, not generalisation.**
  - Recall per rep is almost constant: 8/8/8, 9/9/9, 10/10/10. Token CV is 0.4–7.5 % (computed from `CM-BASE`/`CM-CAND` telemetry).
  - So 3 reps of 1 case ≈ 1 observation of that case. Clustered SEs over cases would be wider, and the error-bars paper (§5) shows clustered SEs can be > 3× the naive ones.
- **Thresholds are below one defect.**
  - One extra detection in 1 of 3 reps is +0.033 on a 10-defect case, which passes the 0.02 recall target.
  - On cm-01, one defect re-rated in every rep is +0.125 severity, and the gate needs only 0.05.
  - CM-SOLO cm-03 was accepted on 2 detections in 9 defect-rep slots (ledger 10, provisional, `paired_agree:false`).
  - Proposal AL-03: an exact sign test on discordant defect×rep pairs. Two-sided p ≤ 0.05 needs 6/6, 8/9 or 9/10 discordant pairs in one direction, and the same direction on ≥ 2 cases.
- **Researcher degrees of freedom.**
  - Detector synonyms were added after the baseline, and a markup-tolerance fix was made after the candidate reports were seen (`CM-SOLO-V1/RESULT.md:19-21`). The second fix was disclosed and applied to both arms, which is good, but it should be impossible by construction: hash the key into the ledger before the first run.
- **Overfitting risk: high, and rising.**
  - cm-01..03 have now been the held-out cases for 3 roles and 4 bundles. Every gate that is read and then re-tried turns them into a dev set.
  - The fixtures are written by the same model family (`RUN-023/RESULT.md:27`), which is a plausible cause of the ceilings.
  - 10 of 11 eval cases are page audits. There is 1 build case and 0 cases for WP production writes, the trading bot, or 3D/office builds, although that is where the tokens go.
- **How the eval set should grow (AL-10):**
  - two tiers: capability, below the ceiling and unseen; and regression, saturated, run after model or skill changes;
  - a `uses` counter per held-out case, demoted to regression after 3 gate uses;
  - new cases from prod-log incidents (type `check`), field snapshots graded blind (RUN-015 was graded by hand, so it could not gate), and builds with hidden tests (RUN-029 has them);
  - Owner spot-labels ~10 extras per quarter to calibrate Fable. This is calibration, not gating, so A8 still holds.
- **Not measured today:**
  - orchestrator tokens (`OFFICE-1 telemetry:4`);
  - input / cache / output split;
  - rework rounds per task;
  - false-PASS rate: a QA or self-test PASS followed by an incident or a later major, as in `RUN-028/RESULT.md:15` (33/33 self-QA, then 2 majors);
  - prod-log incidents per write;
  - Owner edits after COMPLETE;
  - wall time to accepted.
  - Also, `signals.json` covers only RUN-001..007 audits (`learning/signals.json` → runs). Builds, CM runs and production are invisible to CAWL.

## §5 Best practice 2026: adopt / drop (one-person, subscription plan)
**Adopt:**
- **Start simple; add agents only when they measurably help.** You already do this. Keep solo as the default. ([Building effective agents](https://www.anthropic.com/engineering/building-effective-agents))
- **Multi-agent systems cost ~15× chat tokens and pay off for parallel, breadth-first work, not for tightly coupled builds.** Agents alone cost ~4×. This matches RUN-028 (+5.7 % quality for 3–4× tokens). ([Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system))
- **Subagents get a fresh context and return condensed results (≈ 1–2 K tokens).** Use compaction, structured notes and progress files for long work. This supports AL-04 and AL-05. ([Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))
- **Long-running work needs a harness:** a progress file, a feature list marked failing, one feature at a time, and a basic end-to-end test at session start. This is the AL-05 checkpoint pattern instead of 400 K monosessions. ([Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents))
- **Claude Code subagent settings.** The per-subagent `model:` field lets you route work to cheaper models (AL-08). `tools` and `disallowedTools` enforce scope. Resumed subagents "retain their full conversation history" (AL-04). Subagent requests "count toward the same usage limits". ([Subagents docs](https://code.claude.com/docs/en/sub-agents))
- **Eval practice:** grade outcomes, not paths; read transcripts; start with 20–50 tasks from real failures. Capability evals start at a low pass rate and graduate to regression evals once saturated, because "an eval at 100% tracks regressions but provides no signal for improvement". Calibrate LLM judges against humans. This supports AL-02 and AL-10. ([Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents))
- **Eval statistics:** use question-level paired differences, clustered standard errors and power analysis before a run (AL-03). ([Adding error bars to evals](https://arxiv.org/abs/2411.00640); [Anthropic summary](https://www.anthropic.com/research/statistical-approach-to-model-evals))

**Drop or avoid:**
- Imported skill dumps and default councils (already dropped; the ledger confirms it).
- "3 reps of the same case" as the main statistical unit.
- Resuming agents for fix rounds.
- Gating on a case before you know it is below the ceiling.
