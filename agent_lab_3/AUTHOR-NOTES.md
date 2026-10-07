# Author notes — AGENT-LAB-3 cases cm-04..cm-07

Author: a Claude-family model (the same family as the evaluated agents). The one-line rationale says why a strong model might miss each defect. Keys live only under `key/`; nothing in `fixture/` names a defect.

## cm-04-affiliate-review (10 defects, 3 false assertions + 1 unanswerable)
- D01 — The stars look complete; aria-hidden reads like good practice until you ask what a screen reader announces.
- D02 — Both photos have good alt text, which invites skipping the small yes/no icons inside the table.
- D03 — The canonical points at the right page; only its query string is wrong.
- D04 — The rating value matches the sidebar; only the review count differs (128 vs 12).
- D05 — Both dates are valid; their order and the byline's 1 October update are the defect.
- D06 — Three of four partner links carry rel=sponsored, so a spot check of the buttons passes.
- D07 — A disclosure exists and is visible; only its position (after every partner link) is wrong.
- D08 — The dated $79 looks authoritative; $89 in the table and 69.00 in the schema are easy to skip.
- D09 — The inline auto-margin rule is correct on its own; the theme rule that overrides it lives in another file and the drift is invisible at 390 px.
- D10 — The unsupported claim sits inside an otherwise measured, modest review.

## cm-05-ymyl-dermatology (10 defects, 3 false assertions + 1 unanswerable)
- D01 — The citation marker makes the sentence look sourced; the contradiction is in the separate reference file.
- D02 — FAQ and FAQ schema agree with each other; the contradiction is with a sentence in another section.
- D03 — "Medically reviewed by" reads as a passed check; the empty span is invisible when rendered.
- D04 — Both dates are valid calendar dates; only their order is wrong.
- D05 — The first canonical is correct, so a reader who stops at the first match passes it.
- D06 — The card is labelled Sponsored and its link has rel=sponsored, so link-level compliance passes; the harm is the claim and the placement.
- D07 — The explanatory paragraph makes the colour dots look documented, but each item still depends on seeing the colour.
- D08 — Four of five jump links work; agents tend to rate any broken link major, the rubric says minor.
- D09 — The [3] marker looks like every other citation; only counting the entries in the other file reveals the gap.
- D10 — alt attributes are present and non-empty, so automated checks pass; the value is meaningless.

## cm-06-accordion-build (5 root causes, 1 false assertion; 7 hidden tests)
- D01 — The public test names the symptom; the detector checks the report names the lost allowMultiple branch in toggle.
- D02 — An off-by-one on a rarely used key (End); ArrowDown and Home are correct, and the brief's false hint points at ArrowDown.
- D03 — aria-labelledby on the panel is correct, so the markup looks consistent; only the button side uses the index.
- D04 — The CSS regression is outside the JS test file; an agent that only runs tests misses why every panel shows open.
- D05 — Not covered by the public tests and not mentioned in the brief; only SPEC.md against the code reveals it.

## cm-07-release-qa (3 regressions, 4 harmless changes as false-alarm traps)
- D01 — The changelog announces the JSON switch; the field rename reads like part of it, and the dropped status check is a deleted line, visible only against the API contract and the live handler.
- D02 — The changelog calls it "tidied"; minmax(0,1fr) and min-width:0 look like improvements; the removed breakpoints show only side by side.
- D03 — Not in the changelog; the canonical is present and well-formed, only the host differs from live.
- H01–H04 — Rename, variable rename, WebP, moved analytics: each looks like a change worth flagging; each is consistent and announced.
