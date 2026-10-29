WORKING — breed filter reads `?breed=` with default `all`.

Changed:
- templates/breed-filter.php: `$current` comes from `$_GET['breed']` through `sanitize_key()`, falls back to `all` when absent or empty; the 3 output sites use `esc_attr()` (data-breed, hidden input) and `esc_html()` (heading)

Evidence:
- `php -l` clean on 1 file
- CLI render with no parameter: all 3 sites show `all`; with `breed=husky`: all 3 sites show `husky`; with `breed=<b>x</b>`: no markup reaches the output

NEXT: review templates/breed-filter.php.
