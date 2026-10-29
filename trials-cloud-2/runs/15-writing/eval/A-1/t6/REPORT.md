WORKING — `nexus_get_rating` renamed to `nexus_rating_value` in 5 files; 0 references to the old name remain.

## What changed
- `inc/schema.php` — definition at L12 renamed; call site at L32 updated.
- `inc/helpers.php` — call site at L10 updated (`nexus_rating_stars`).
- `templates/figure-rating.php` — call site at L7 updated.
- `templates/review-card.php` — call site at L8 updated.
- `tests/test-rating.php` — 2 call sites (L9, L14) updated.

Not touched: `functions.php`, `inc/compat.php` (no references). Rename only; no logic, formatting or docblock changes. Tabs and LF endings preserved.

## Evidence
- `grep -rn nexus_get_rating` over all `.php` files: 0 hits after the change (7 hits before).
- `grep -rn nexus_rating_value`: 7 hits in 5 files (1 definition, 6 call sites).
- `php -l` clean on 7 files (every PHP file in the repo).
- `php tests/test-rating.php`: `ok`, exit 0, before and after the change.
- Smoke render of `templates/review-card.php` and `templates/figure-rating.php` under the CLI with 2 review rows: both render, exit 0, rating `4.5`.
- No `package.json` present, so no `npm test` to run.

## Open questions
- None. The packet was unambiguous; no other files in the repo reference the helper.

NEXT: commit the 5 touched files.
