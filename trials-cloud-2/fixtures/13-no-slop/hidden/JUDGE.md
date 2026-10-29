# Blind pairwise design judge — task 13

Identical protocol to `../../12-frontend-design/hidden/JUDGE.md` (shared harness). Build pairs with:

```
node ../12-frontend-design/hidden/judge-pair.mjs <run-dir-A> <run-dir-B> <pair-dir>
```

and use the judge prompt from that file verbatim (the "distinctiveness" criterion names both products; the judge only sees
the screenshots, so this is harmless). Slop-marker counts come from `grade.mjs` `details.slop` and are a secondary
metric, never part of the score.
