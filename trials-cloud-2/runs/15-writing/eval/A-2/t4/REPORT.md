WORKING — breed filter partial reads `breed` from the query string, defaults to `all`, escaped at all 3 outputs.

## What changed
- `templates/breed-filter.php` (L8-L11): hardcoded `'labrador'` replaced by `isset( $_GET['breed'] ) ? sanitize_key( $_GET['breed'] ) : 'all'`, with an empty result falling back to `'all'`.
- `templates/breed-filter.php` (L13, L14, L16): the wrapper `data-breed` and the hidden input use `esc_attr()`, the heading uses `esc_html()`. 0 raw `echo $current` remain (grep count).
- `inc/compat.php`: read only, not touched.

## Evidence
- `php -l` clean on 2 files (`templates/breed-filter.php`, `inc/compat.php`).
- PHP CLI smoke test, 4 cases, all 3 outputs checked per case:
  - parameter absent: `all` in `data-breed`, heading and hidden input.
  - `breed=` (empty): `all` in all 3 places.
  - `breed=Poodle`: `poodle` in all 3 places (lower-cased by `sanitize_key`).
  - `breed=<b>x"y</b>`: `bxyb` in all 3 places, no markup reaches the HTML.
- No `package.json` in the run directory, so `npm test` not applicable.

## Open questions
- `sanitize_key` strips characters outside `[a-z0-9_-]` and lower-cases; a value that sanitises to nothing (for example `breed=???`) is treated as "empty" and shows `all`. Chosen as the smallest change; adjust if the heading should keep the original casing.
- No breed whitelist exists in the inputs, so none is applied; one belongs in `inc/helpers.php` if the catalogue defines the breed list.

NEXT: review the diff of `templates/breed-filter.php` and commit.
