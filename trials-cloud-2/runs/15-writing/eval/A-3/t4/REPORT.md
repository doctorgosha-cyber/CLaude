WORKING — breed filter partial now reads the `breed` query parameter in all 3 places, default `all`.

## What changed
- `templates/breed-filter.php` — L8 replaced the hardcoded `'labrador'` with `isset( $_GET['breed'] ) ? sanitize_key( $_GET['breed'] ) : 'all'`; L9–L11 fall back to `all` when the value is empty. The wrapper `data-breed` (L13) and hidden input `value` (L16) now echo through `esc_attr()`, the heading (L14) through `esc_html()`. 1 file touched, no other files changed.

## Evidence
- `php -l` clean on 2 files (`templates/breed-filter.php`, `inc/compat.php`).
- CLI smoke test (`php -r` with `parse_str` into `$_GET`, then `include` of the partial), 4 cases:
  - parameter absent → `data-breed="all"`, heading `all`, hidden value `all`
  - `breed=` (empty) → all 3 places `all`
  - `breed=beagle` → all 3 places `beagle`
  - `breed=<B>Poodle&x` → all 3 places `bpoodle` (markup stripped by `sanitize_key`, then escaped at output)
- `npm test` not run: no `package.json` in the run directory.

## Open questions
- "Empty" is read as covering both `breed=` and a value that `sanitize_key()` reduces to an empty string (e.g. `breed=!!!`); both fall back to `all`. If only a literally empty parameter should default, drop L9–L11 and the second case is a no-op anyway.
- There is no whitelist of breed slugs on disk, so the value is sanitised (`sanitize_key`) but not validated against a known list.

NEXT: validate `$current` against the breed list once one exists in `data/` (falls back to `all` on no match).
