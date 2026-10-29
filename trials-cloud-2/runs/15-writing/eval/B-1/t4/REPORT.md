WORKING — breed filter reads `breed` from the query string, escaped at all 3 output points.

## What changed

- `templates/breed-filter.php`: replaced the hardcoded `'labrador'` with `$current` read from `$_GET['breed']` through `sanitize_key()`, falling back to `all` when the parameter is absent or empty. The wrapper `data-breed` and the hidden input now go through `esc_attr()`, the heading through `esc_html()` (the old file echoed `$current` raw in all 3 places).

## Evidence

- `php -l` clean on 1 file (`templates/breed-filter.php`).
- Smoke run under the PHP CLI with `inc/compat.php` escapers, 4 cases:
  - no `breed` param: `data-breed="all"`, hidden value `all`, heading `all`.
  - `breed=`: same 3 outputs, `all`.
  - `breed=poodle`: `data-breed="poodle"`, hidden value `poodle`, heading `Showing results for poodle`.
  - `breed=<b>x</b>`: `sanitize_key()` strips to `bxb`; 0 raw tags reach the HTML.
- 0 CR characters in the touched file; tabs kept.
- `npm test`: not run, no `package.json` in the run directory.

## Open questions

- A value that `sanitize_key()` reduces to an empty string (e.g. `breed=!!!`) also falls back to `all`; the packet only names absent/empty, this reading seemed the safest for the hidden input.
- No whitelist of breeds exists in the stripped repo, so the partial accepts any sanitised key; a whitelist against `data/foods.json` could be added when that file is in scope.

NEXT: review and commit `templates/breed-filter.php`.
