WORKING — weight helper added and wired into the figure partial; `php -l` clean on 2 files.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` appended after `nexus_kind_label()`. Under 1 kg returns whole grams (`850 g`); 1 kg and over returns one decimal via `number_format()` (`12.5 kg`, `2.0 kg`).
- `templates/figure.php` L17: the "Pack weight" `<dd>` now echoes `esc_html( nexus_format_weight( (float) $figure['weight_kg'] ) )`; the hard-coded ` kg` suffix is gone. No other lines touched.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`).
- Unit check via `php -r` on 8 inputs: `0.85` -> `850 g`, `0.5` -> `500 g`, `1.0` -> `1.0 kg`, `2.0` -> `2.0 kg`, `12.5` -> `12.5 kg`, `12.55` -> `12.6 kg`, `0.0` -> `0 g`, `0.9996` -> `1000 g`.
- Rendered `templates/figure.php` under the PHP CLI with the compat layer for 2 figures (`0.85` kg and `12.5` kg): "Pack weight" rows read `850 g` and `12.5 kg`.
- No `package.json` present, so no `npm test` run.

## Open questions
- Grams are rounded to the nearest whole gram, so a value just under 1 kg (e.g. `0.9996`) prints `1000 g` rather than `1.0 kg`. Chosen because it changes the fewest lines; flip the threshold to the rounded gram count if `1.0 kg` is preferred there.
- Negative weights are not special-cased (they fall into the grams branch); the packet did not mention them.

NEXT: reviewer commits `inc/helpers.php` and `templates/figure.php`.
