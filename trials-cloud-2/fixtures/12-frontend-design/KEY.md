# KEY — 12-frontend-design (skill: frontend-design, Apache-2.0)

Sibling of `13-no-slop`; both are graded by the SAME harness in `12-frontend-design/hidden/harness.mjs`
(13's `grade.mjs` imports it by relative path). Grade: `node grade.mjs <run-dir>` (~25 s, one JSON line, writes only
`<run-dir>/__grade__/` and deletes it). Tools (exact versions, installed in
`/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/12-frontend-design`, `13-no-slop` is a
symlink to it; override with `TRIAL_TOOLS_DIR`): playwright-core 1.64.1, axe-core 4.14.0, lighthouse 13.6.0 (chrome-launcher 1.2.2),
Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (`CHROME_PATH` to override).

## Task
Build a product-comparison section (6 pet foods from `data/products.json`: species filter, min/max price, 5 sort keys,
compare-up-to-3 with a sticky bar) as `index.html` + `styles.css` + `app.js`, no frameworks/CDN/inline handlers.
`task/` ships the README spec, data, placeholder SVGs (synthetic, drawn by the task author), empty starters, `serve.mjs`
and an `npm test` that only does static checks (files, no external resources, testids mentioned) — it says nothing about behaviour.

## Score (same formula for 12 and 13)
`score = 0.6 * behaviour + 0.2 * axe + 0.2 * lighthouse`
- behaviour = passed/total over 4 static checks + 23 browser tests (`hidden/tests.mjs`). Each browser test is run at
  390×844 and 1280×800 and counts once, passing only if it passes at BOTH viewports. Tests that cannot run because
  nothing rendered count as failed.
- axe = 1 if zero violations (axe-core, tags wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa, union of unique rule ids over 4
  states: desktop initial, desktop with 2 selected, desktop empty-results, mobile initial), else max(0, 1 − violations/5).
- lighthouse = 1 if accessibility ≥ 90 AND performance ≥ 85 (mobile preset, ONE run — stated here; 3 repeated runs on the
  reference gave identical scores, the page has no network dependencies so lantern simulation is stable), else
  0.5 × min(1, a11y/90, perf/85).
- axe and lighthouse components are 0 when no `product-card` renders at all (nothing to audit).
- `details.slop` (hidden/slop-markers.mjs) counts gradient text, glow stacks (≥3 box-shadows or blur > 20 px), uppercase
  tracked eyebrow labels/pills above headings, icon-tile grids, purple→blue gradients, font families (>3 flagged), ✨/🚀 in
  headings. It is a SECONDARY metric reported for the write-up and NOT part of the score. Validated on a synthetic sloppy
  page (all 7 markers fire) and on both references (0).
- `hidden/JUDGE.md` + `hidden/judge-pair.mjs` + `hidden/screenshot.mjs`: optional blind pairwise design judge
  (random left/right mapping kept in `mapping.json` outside the judge's folder). Secondary as well.

## Verified scores
- untouched `task/`: **0.067** (3/27: only static self-contained + data-untouched + no-page-errors pass)
- `reference/`: **1.0** (27/27, axe 0, LH 100/100, slop total 0), ~24 s
- degraded reference: (d1) code-unit tie-break + `'£'+n` price → 0.956; (d2) `outline:none` + two selects without
  `for=` labels → 0.938 (axe select-name, LH a11y 95); (d3) static compare bar + selection cleared on filter → 0.956.

## Hidden edge cases (each stated once, densely, in the README's "Details" section)
- price `£9.90` / `£18.00` from `currency.symbol` with `toFixed(2)` (data has 9.9, 18, 24, 12.5, 20, 31.75); rating `4.0` for 4.
- inclusive bounds tested at exact prices (12.5 min, 20 max) and just beyond (12.51 / 19.99); empty input = no bound.
- sort ties: three products share rating 4.5 (`bowl&co …`, `Northcoast …`, `Oakfield …`) → case-insensitive name order
  (`localeCompare`); plain `<` puts `bowl&co` last. Protein tie 32 (Northcoast vs Sterling). `featured` = JSON order.
- `empty-results` must be visible only when nothing matches (min 25 + max 20), hidden otherwise.
- compare cap 3 with `disabled` on the others (test clicks the 4th via `el.click()`), count element text must be only the
  number, bar `position` fixed/sticky and hidden at 0, selection must survive filtering, `compare-clear`.
- keyboard: Tab order (filters before cards), Enter AND Space toggle (real `<button aria-pressed>`), focus ring visible on
  toggle and select, no horizontal overflow at 390.
- axe on 4 states: common failures are `label-content-name-mismatch` (aria-label that doesn't contain the visible text —
  my first reference hit it), `select-name`, `color-contrast` on the badge/bar, `target-size` (24×24 for inputs/selects).
- Lighthouse perf: injecting content above other content after `fetch` creates CLS (the 13 reference lost 24 points this way).

## Expected plain-agent weaknesses
Most agents will pass the obvious tests; points are lost on: tie-break/case rules, exact `compare-count` text,
aria-label vs visible text, 24 px targets on native selects, focus styles removed by a reset, empty-results toggling,
selection persistence across filters, and (for the frontend-design skill arm) adding decorative chrome that trips axe
contrast. Expect roughly 0.55–0.85 for a plain agent.
