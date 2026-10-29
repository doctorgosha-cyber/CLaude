WORKING — breed filter partial now reads the `breed` query parameter in all 3 places, with `all` as the default.

## What changed
- `templates/breed-filter.php`: L8-L11 replace the hardcoded `'labrador'` with `isset( $_GET['breed'] ) ? sanitize_key( $_GET['breed'] ) : ''`, falling back to `all` when the result is empty. The 3 output points (wrapper `data-breed` L13, heading L14, hidden input L16) now use `$current` through `esc_attr()` / `esc_html()` / `esc_attr()` instead of a raw `echo`.
- No other file touched. `inc/compat.php` read only (supplies `sanitize_key`, `esc_html`, `esc_attr` for the CLI).

## Evidence
- `php -l` clean on 1 file (`templates/breed-filter.php`).
- `npm test`: not run, no `package.json` in the run directory.
- CLI smoke test, `php -r` with `$_GET` set then `include` of the partial, 5 cases:

| Case | `$_GET['breed']` | Rendered value (3 places) |
| --- | --- | --- |
| absent | unset | `all` |
| empty | `""` | `all` |
| normal | `Poodle` | `poodle` |
| markup | `<script>x</script>` | `scriptxscript` |
| junk | `???` | `all` |

- `grep -c 'echo \$current'` on the partial: 0 raw echoes remain; all 3 outputs go through an escaper.
- Tabs preserved (checked with `cat -A`), Unix line endings, no reformatting elsewhere in the file.

## Open questions
- `sanitize_key()` lowercases and strips non `[a-z0-9_-]` characters, so `Poodle` renders as `poodle` and a value that sanitises to nothing (`???`) falls back to `all`. The packet says "absent or empty"; I treated "empty after sanitising" as empty too, since that is the only reading that never emits an empty `data-breed`. Flag if the heading should keep the original casing (that would need a separate display label, which the packet did not ask for).
- There is no breed whitelist in the stripped repo, so any sanitised key is accepted; a whitelist against the breed list would belong in a future packet.

NEXT: reviewer commits `templates/breed-filter.php`.
