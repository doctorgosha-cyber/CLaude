WORKING — breed filter partial now reads `breed` from the query string in all 3 places, default `all`.

## What changed
- `templates/breed-filter.php` L8–L11: `$current` is `sanitize_key( $_GET['breed'] )` when set, falling back to `all` when the parameter is absent or empty (replaces the hardcoded `labrador`).
- Same file L13, L14, L16: wrapper `data-breed` and hidden input use `esc_attr()`, heading uses `esc_html()` at the point of output. No other lines touched; tabs and layout kept as found.
- `inc/compat.php`: read only, unchanged.

## Evidence
- `php -l` clean on 2 files (`templates/breed-filter.php`, `inc/compat.php`).
- CLI smoke test via `php -r` including the partial, 4 cases, each checked in 3 places (wrapper attribute, heading, hidden input):
  - `$_GET` absent → `all` / `all` / `all`
  - `breed=""` → `all` / `all` / `all`
  - `breed=pug` → `pug` / `pug` / `pug`
  - `breed=<b>"x` → `bx` in all 3 places (sanitize_key strips the markup; escapers applied on output).
- No `package.json` in the run directory, so no `npm test` to run.
- Whitespace: 8 tab-indented lines, Unix line endings (`file` reports ASCII text, no CRLF).

## Open questions
- A value that `sanitize_key()` reduces to the empty string (e.g. `breed=???`) is treated as empty and falls back to `all`; the packet says "absent or empty" and this was the reading that changed the fewest lines.
- There is no whitelist of known breeds in the repo, so any key-safe string is accepted and shown as-is.

NEXT: commit `templates/breed-filter.php`.
