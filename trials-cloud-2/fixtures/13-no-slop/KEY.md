# KEY — 13-no-slop (skill: no-ai-design-slop, MIT)

Sibling of `12-frontend-design`; graded by the SAME harness: `grade.mjs` imports
`../12-frontend-design/hidden/harness.mjs` (tools, viewports, axe states, Lighthouse, slop counter, score formula are
identical — see `../12-frontend-design/KEY.md` for the formula, tool versions and the slop/judge secondary metrics).
Grade: `node grade.mjs <run-dir>` (~25 s, one JSON line, only `<run-dir>/__grade__/` is created and removed).

## Task
Build the landing section of the "Anatomy of Things" explainer-film channel from `data/films.json`: hero (h1 + tagline),
language `<select>` (10 languages) that re-titles 4 film cards from the JSON translations, cards with duration / language
count / link, and a newsletter form with JS validation and a live-region status. Same tech constraints as task 12.
Placeholder thumbnails are synthetic SVGs drawn by the task author.

## Score
`0.6 * behaviour (4 static + 20 browser tests, each must pass at 390 and 1280) + 0.2 * axe (4 states: desktop initial,
desktop error state, desktop in Japanese, mobile initial) + 0.2 * lighthouse (a11y ≥ 90 & perf ≥ 85, one run)`.
Slop-marker counts in `details.slop` are secondary only (not scored). JUDGE.md: same blind pairwise protocol as task 12.

## Verified scores
- untouched `task/`: **0.075** (3/24)
- `reference/`: **1.0** (24/24, axe 0, LH 100/100, slop total 0), ~25 s
- degraded reference: (d1) `m:s` without zero-pad, always "languages", no `lang="en"` on fallback → 0.925;
  (d2) native validation only (no `novalidate`, no submit handler) + `outline:none` → 0.825;
  (d3) no paint gate (CLS 0.76 → perf 76) + low-contrast meta text + select without label → 0.809 (axe color-contrast,
  select-name; LH 91/76).

## Hidden edge cases (one dense sentence each in the README)
- duration `m:ss`: 59 → `0:59`, 1203 → `20:03`, 425 → `7:05`, 612 → `10:12`.
- language count uses `languages.length` (pencil = 1 → singular `1 language`; kettle has 7 titles AND 7 languages, but
  the zipper/lock have 10) — counting titles or hard-coding plural fails.
- fallback: `pencil` has only an English title, `kettle` lacks pl/tr/ja → must show English AND mark it `lang="en"`,
  while `<html lang>` follows the select; translated titles must not be mis-marked.
- switching language must keep card order and keep focus on the select (rebuilding the DOM around it fails).
- form: `novalidate` required (native validation blocks the submit event so no status appears); trim; `a@b` and
  `user@@example.com` invalid; error → `data-state="error"`, `aria-invalid="true"`, focus to the input; success clears
  `aria-invalid`; status element present and empty at load with `role=status`/`aria-live`; Enter in the field submits;
  URL must not change (no navigation).
- `film-link` href must equal the JSON `url` exactly and its accessible name must contain the title.
- exactly one `h1`, inside `hero`, containing `channel.name`; tagline text from JSON present in the hero.
- Lighthouse perf: fetch-then-inject pushes the newsletter down → CLS ≈ 0.76 → perf 76 → −0.11 on the score.

## Expected plain-agent weaknesses
Zero-padding, singular/plural, `lang` on fallback titles, `novalidate` + custom submit handling, focus management on
error, CLS from late-injected content, 24 px targets on the native select, contrast of "soft" meta text. Expect roughly
0.6–0.85 for a plain agent; the no-slop skill arm's risk is spending effort on design review instead of these details.
