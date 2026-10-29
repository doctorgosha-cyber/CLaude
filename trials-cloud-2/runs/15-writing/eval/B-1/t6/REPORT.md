WORKING — `nexus_get_rating` renamed to `nexus_rating_value` at 7 sites in 5 files; test passes.

## What changed

Plain identifier rename, no behaviour change. Files touched:

- `inc/schema.php`: definition (L12) and call in `nexus_product_schema` (L32)
- `inc/helpers.php`: call in `nexus_rating_stars` (L10)
- `templates/figure-rating.php`: call (L7)
- `templates/review-card.php`: call (L8)
- `tests/test-rating.php`: 2 calls (L9, L14)

`functions.php` and `inc/compat.php` read, no occurrence, untouched. Docblock text, indentation (tabs) and line endings unchanged.

## Evidence

- `php tests/test-rating.php`: `ok`, exit 0 before the change and after the change.
- `php -l` clean on 5 files.
- `grep -rn nexus_get_rating --include=*.php .`: 0 matches after the rename (only `PACKET.md` still names the old name).
- `grep -rn nexus_rating_value --include=*.php .`: 7 matches.
- No `package.json` in the run directory, so no `npm test`.

## Open questions

- None.

NEXT: reviewer commits the 5 changed files.
