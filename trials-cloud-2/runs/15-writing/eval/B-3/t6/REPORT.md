WORKING — `nexus_get_rating` renamed to `nexus_rating_value` in 5 files, 7 occurrences, test passes.

## What changed
- `inc/schema.php` — definition L12 and call in `nexus_product_schema` L32
- `inc/helpers.php` — call in `nexus_rating_stars` L10
- `templates/figure-rating.php` — call L7
- `templates/review-card.php` — call L8
- `tests/test-rating.php` — calls L9 and L14
- `functions.php` — read, unchanged (bootstrap only, no reference)

Behaviour unchanged: the body of the function and every call site are byte-identical apart from the name; the docblocks did not mention the old name.

## Evidence
- `php tests/test-rating.php` → `ok`, exit `0`, run before and after the rename (2 runs)
- `php -l` clean on 5 files touched
- `grep -rn nexus_get_rating --include=*.php .` → 0 matches after; `nexus_rating_value` → 7 matches across 5 files
- Template smoke under PHP CLI (`review-card.php`, `figure-rating.php` with 2 review rows) renders stars `4.5` and bar width `90 %`, no notices
- No `package.json`, so no `npm test`

## Open questions
- `PACKET.md` still quotes the old name in its task line; left as-is since it is the packet, not the theme.

NEXT: commit the 5 renamed files.
