WORKING — `nexus_get_rating` renamed to `nexus_rating_value` in 5 files; test passes.

## What changed
- `inc/schema.php` — definition at L12 and call site at L32 (in `nexus_product_schema`)
- `inc/helpers.php` — call site at L10 (in `nexus_rating_stars`)
- `templates/figure-rating.php` — call site at L7
- `templates/review-card.php` — call site at L8
- `tests/test-rating.php` — 2 call sites, L9 and L14

Not touched: `functions.php`, `inc/compat.php` (no references). Behaviour and signatures unchanged; the only edit is the identifier.

## Evidence
- `grep -rn nexus_get_rating --include=*.php .` — 0 hits after the change; `nexus_rating_value` — 7 hits across 5 files (1 definition, 6 calls).
- `php -l` clean on 5 files touched.
- `php tests/test-rating.php` — `ok`, exit 0 before and after the change.
- Smoke render of both templates with 3 review rows via PHP CLI: rating bar renders `Rating 4.3` / `86%`, review card renders `★★★★☆ 4.3`; exit 0.
- No `package.json` in the repo, so no `npm test`.

## Open questions
- PACKET.md still names the old function; left unchanged since it is the task packet, not theme code.

NEXT: merge the rename.
