WORKING — `nexus_get_rating` renamed to `nexus_rating_value` in 5 files; test passes.

## What changed

Rename only, behaviour unchanged. 7 occurrences replaced across 5 files; no other edits.

- `inc/schema.php` — definition (L12) and call site in `nexus_product_schema` (L32)
- `inc/helpers.php` — call site in `nexus_rating_stars` (L10)
- `templates/figure-rating.php` — call site (L7)
- `templates/review-card.php` — call site (L8)
- `tests/test-rating.php` — 2 call sites (L9, L14)

Not touched: `functions.php`, `inc/compat.php` (listed inputs, no occurrences). `PACKET.md` still mentions the old name in its task text; left as is since it is the packet, not theme code.

## Evidence

- `grep -rn nexus_get_rating` over the run directory: 0 hits in `*.php` after the change (only `PACKET.md` L2).
- `grep -rn nexus_rating_value --include=*.php`: 7 hits in 5 files, matching the 7 pre-change hits of the old name.
- `php -l` clean on 5 files (the 5 touched files).
- `php tests/test-rating.php`: `ok`, exit 0 before and after the change.
- CLI smoke render of `templates/figure-rating.php` + `templates/review-card.php` with 2 review rows: 257 bytes of output, `width: 90%` and `4.5` present, no warnings.
- No `package.json` in the run directory, so no `npm test` to run.
- Line endings and indentation unchanged (tabs in PHP, Unix line endings) per `file` and `cat -A`.

## Open questions

- None. Packet was unambiguous; `functions.php` is includes-only and needed no change.

NEXT: reviewer commits the 5 touched files.
