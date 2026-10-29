WORKING — weight helper added and wired into the figure partial, `php -l` clean on 2 files.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` appended after `nexus_kind_label()` (docblock L25, function L29–L34). Under 1 kg returns whole grams (`850 g`); 1 kg and over returns one decimal via `number_format()` (`12.5 kg`, `2.0 kg`). No thousands separator, matching `nexus_format_price()`.
- `templates/figure.php`: "Pack weight" row (L17) now echoes `esc_html( nexus_format_weight( (float) $figure['weight_kg'] ) )`; the hard-coded ` kg` suffix is gone. Nothing else in either file touched.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`), PHP `8.3`.
- Unit check, 8 values via `php -r`: `0.85 → 850 g`, `0.5 → 500 g`, `1 → 1.0 kg`, `2 → 2.0 kg`, `12.5 → 12.5 kg`, `12.55 → 12.6 kg`, `0 → 0 g`.
- Template smoke test, 2 renders of `templates/figure.php` under the CLI with `inc/compat.php`: `<dd>850 g</dd>` for `0.85` and `<dd>12.5 kg</dd>` for `12.5`.
- Both files ASCII, 0 CR characters, tabs preserved.
- No `package.json` in the run directory, so `npm test` not applicable.

## Open questions
- Values just under 1 kg round up to `1000 g` (e.g. `0.9996 kg`); the packet's rule is "under 1 kg = grams", so the threshold is applied to the raw value, not the rounded one. Flip to `>= 0.9995` if `1.0 kg` is preferred there.
- Negative weights are not guarded; they fall into the grams branch (`-500 g`). Catalogue data has no negatives, so left as is.

NEXT: run the figure partial through the real figure-page build once to confirm the byte budgets in `figures/targets.json` are unaffected by the shorter weight cell.
