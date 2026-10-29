WORKING — `nexus_get_rating` renamed to `nexus_rating_value` in 5 files, test passes.

## What changed
- `inc/schema.php`: definition at L12 and call site at L32.
- `inc/helpers.php`: call site at L10 (`nexus_rating_stars`).
- `templates/figure-rating.php`: call site at L7.
- `templates/review-card.php`: call site at L8.
- `tests/test-rating.php`: 2 call sites, L9 and L14.
- `functions.php` and `inc/compat.php`: read, no occurrence, untouched.

Rename only (7 occurrences across 5 files); no other edits, indentation, line endings or docblocks changed. Behaviour unchanged.

## Evidence
- `grep -rn nexus_get_rating --include=*.php .`: 0 hits after the change; `nexus_rating_value`: 7 hits.
- `php -l` clean on 5 files.
- `php tests/test-rating.php`: `ok`, exit 0, both before and after the change.
- No `package.json`, so no `npm test` to run.

## Open questions
- None. `PACKET.md` still mentions the old name in its task text; left as is (packet, not theme).

NEXT: reviewer commits the 5 touched files.
