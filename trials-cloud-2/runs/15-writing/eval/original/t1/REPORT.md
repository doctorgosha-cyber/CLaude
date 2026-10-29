WORKING — weight formatter added and wired into the figure partial, 2 files changed.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` (L25–L34, docblock from L25, function at L29). Under 1 kg returns whole grams (`850 g`); 1 kg and over returns one decimal (`12.5 kg`, `2.0 kg`).
- `templates/figure.php`: the "Pack weight" row (L17) now echoes `esc_html( nexus_format_weight( $figure['weight_kg'] ) )` instead of the raw float plus a literal ` kg`.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`).
- CLI smoke test via `inc/compat.php` on 8 values: `0.85` → `850 g`, `0.999` → `999 g`, `1.0` → `1.0 kg`, `2.0` → `2.0 kg`, `12.5` → `12.5 kg`, `12.55` → `12.6 kg`, `0.0` → `0 g`.
- Partial rendered twice (`0.85` and `12.5`): output rows read `<dd>850 g</dd>` and `<dd>12.5 kg</dd>`; title escaping unchanged.
- `npm test`: not run, no `package.json` in the run directory.
- Tabs and Unix line endings preserved; no other lines touched.

## Open questions
- Grams are rounded to the nearest whole gram, so `0.9996` kg renders as `1000 g` rather than `1.0 kg`. Packet did not specify; chose the reading that keeps the `< 1 kg` branch simple. Say if the threshold should apply after rounding.

NEXT: review the diff on `inc/helpers.php` and `templates/figure.php` and commit.
