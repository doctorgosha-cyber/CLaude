# Blind pairwise design judge (secondary metric, never part of `grade.mjs`)

The automatic score (`grade.mjs`) is the primary metric. This protocol adds a *design-quality* signal that scripts cannot
measure. It is run once per (Arm A run, Arm B run) pair, blind, with a fixed rubric.

## 1. Build the anonymised pair (coordinator)

```
node hidden/judge-pair.mjs <run-dir-A> <run-dir-B> <pair-dir>
```

This renders both run dirs (full page, 390 px and 1280 px) and writes:

- `<pair-dir>/judge/left-1280.png`, `right-1280.png`, `left-390.png`, `right-390.png` — the ONLY files the judge may see
- `<pair-dir>/mapping.json` — which arm is left/right (random per pair). The judge never sees this file. Unblind only after
  all judge outputs for the trial are written.

Pair runs by repetition index (A-rep1 vs B-rep1, …). Do not reuse a judge session across pairs.

## 2. Judge prompt (verbatim, one fresh model session per pair, temperature default, images attached)

> You are judging two implementations of the same UI brief. Attached are screenshots `left-1280.png` and `right-1280.png`
> (desktop) and `left-390.png`, `right-390.png` (phone). You do not know who made either. Rate EACH side on three criteria,
> each 1–5 (5 = excellent):
>
> - **Clarity** — can a first-time reader tell what this section is for and how to use it within a few seconds?
> - **Hierarchy** — is there one obvious focal point, and does size/weight/placement guide the eye in a sensible order on
>   both viewports?
> - **Distinctiveness** — does it look designed for this specific product (pet-food comparison / explainer-film channel)
>   rather than a generic template? Decorative effects that carry no meaning count against this.
>
> Ignore placeholder imagery quality. Judge the visible result only. Output exactly this JSON and nothing else:
> `{"left":{"clarity":n,"hierarchy":n,"distinctiveness":n},"right":{"clarity":n,"hierarchy":n,"distinctiveness":n},"preferred":"left"|"right"|"tie","reason":"<=40 words"}`

## 3. Record

Append one line per pair to `judge-results.jsonl` with the pair id and the judge's JSON. After all pairs are judged, join
with `mapping.json` to attribute `left`/`right` to arms. Report mean per-criterion score per arm and the preference count.

## 4. Rules

- One judge call per pair; no re-rolls. If the judge's output is not valid JSON, record it as `tie` with all scores 3.
- A run whose page does not render (grade `details.rendered=false`) is scored 1/1/1 without being judged.
- Do not show the judge the brief, the arm names, the skill text, or grade output.
