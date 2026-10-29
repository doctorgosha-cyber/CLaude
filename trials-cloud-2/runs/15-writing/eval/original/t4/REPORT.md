WORKING — breed filter reads `breed` from the query string, 3 output sites escaped, `php -l` clean on 1 file.

What changed
- `templates/breed-filter.php`: `$current` is now `isset( $_GET['breed'] ) ? sanitize_key( $_GET['breed'] ) : 'all'`, with an empty value falling back to `all` (L8-L11). The wrapper `data-breed` (L13) and hidden input value (L16) go through `esc_attr()`, the heading (L14) through `esc_html()`. Hardcoded `labrador` removed.
- `inc/compat.php`: read only, unchanged.

Evidence
- `php -l` clean on 1 file (`templates/breed-filter.php`); `inc/compat.php` also clean.
- CLI smoke test via `php -r` with `include`, 4 cases:
  - `$_GET` absent: all 3 sites render `all`.
  - `breed=""`: all 3 sites render `all`.
  - `breed=Poodle`: all 3 sites render `poodle` (lowercased by `sanitize_key()`).
  - `breed=<script>alert(1)</script>`: renders `scriptalert1script`, 0 raw tags in output.
- `grep -c 'echo \$current'` on the template: 0 unescaped echoes remain.
- No `package.json` in the run directory, so `npm test` not applicable.

Open questions
- `sanitize_key()` lowercases and strips to `[a-z0-9_-]`, so `breed=Poodle` is shown as `poodle` in the heading. If the heading should show a display name, a lookup from the breed slug is needed; out of scope for this packet.
- A value that sanitises to empty (e.g. `breed=???`) is treated as `all`, same as an absent parameter. Chosen as the reading that changes the fewest files.

NEXT: reviewer commits `templates/breed-filter.php`.
