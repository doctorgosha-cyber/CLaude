WORKING — breed filter now reads the `breed` query parameter in all 3 places, default `all`.

## What changed
- `templates/breed-filter.php`: `$current` now comes from `$_GET['breed']` via `sanitize_key()` with default `all` when absent, and falls back to `all` when the (sanitised) value is empty (L8–L11). The heading echoes through `esc_html()` (L14); the hidden input `value` (L17) and the wrapper `data-breed` (L13) echo through `esc_attr()`. No other lines touched.

## Evidence
- `php -l` clean on 1 file (`templates/breed-filter.php`).
- CLI smoke test, 3 cases via `php -r` including the partial: no parameter renders `all` in 3 places; `breed=` (empty) renders `all` in 3 places; `breed=Poodle<b>x` renders `poodlebx` in 3 places (sanitised, no raw markup reaches the HTML).
- No `package.json` in the run directory, so `npm test` not applicable.

## Open questions
- A value that sanitises to empty (for example `breed=???`) is treated the same as an empty parameter and defaults to `all`; the packet names only "absent or empty", so this is the smallest consistent reading.
- `sanitize_key()` lowercases the breed, so the heading shows `labrador` rather than `Labrador`; no display-casing helper exists in `inc/`, and the packet did not ask for one.

NEXT: reviewer commits `templates/breed-filter.php`.
