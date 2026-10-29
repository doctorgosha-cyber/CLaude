WORKING — weight formatter added and wired into the figure partial.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` appended after `nexus_kind_label()`. Under 1 kg returns whole grams (`850 g`); 1 kg and over returns one decimal (`12.5 kg`, `2.0 kg`).
- `templates/figure.php` L17: the "Pack weight" `<dd>` now echoes `esc_html( nexus_format_weight( $figure['weight_kg'] ) )`; the hard-coded ` kg` suffix is gone.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`).
- Unit check via `php -r` on 8 values: `0.85` → `850 g`, `0.999` → `999 g`, `1.0` → `1.0 kg`, `2.0` → `2.0 kg`, `12.5` → `12.5 kg`, `12.55` → `12.6 kg`, `0` → `0 g`.
- Smoke render of `templates/figure.php` with `inc/compat.php` for 2 figures: rows read `<dd>850 g</dd>` and `<dd>12.5 kg</dd>`.
- No `package.json` in the repo, so no `npm test` to run.

## Open questions
- Grams are rounded to the nearest whole gram, so `0.9996 kg` renders as `1000 g` rather than `1.0 kg`. The packet only specifies the 1 kg threshold; left as is.
- Zero and negative inputs are not guarded (`0` → `0 g`); the packet did not ask for validation.

NEXT: run the figure partial against real catalogue weights from `data/foods.json` to confirm no pack lands on the `1000 g` rounding edge.
