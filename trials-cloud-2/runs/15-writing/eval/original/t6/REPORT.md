WORKING — `nexus_get_rating` renamed to `nexus_rating_value` in 5 files, 7 occurrences, test passes.

## What changed
- `inc/schema.php` — definition (L12) and call in `nexus_product_schema` (L32)
- `inc/helpers.php` — call in `nexus_rating_stars` (L10)
- `templates/figure-rating.php` — call (L7)
- `templates/review-card.php` — call (L8)
- `tests/test-rating.php` — 2 calls (L9, L14)
- `functions.php` — not touched (bootstrap only, no reference to the helper)

Behaviour unchanged: rename only, no body, signature or docblock edits beyond the name.

## Evidence
- `grep -rn nexus_get_rating --include=*.php .` — 0 matches after the change (7 matches before)
- `grep -rn nexus_rating_value --include=*.php .` — 7 matches across 5 files
- `php -l` clean on 5 files
- `php tests/test-rating.php` — `ok`, exit code 0, before and after the change
- CLI smoke render of `templates/review-card.php` and `templates/figure-rating.php` with 2 review rows — renders, no undefined-function error
- `npm test` not run: no `package.json` in the run directory

## Open questions
- `PACKET.md` L2 still names the old function in its task text; left as is, it is the brief, not theme code.

NEXT: reviewer commits the 5 touched files.
