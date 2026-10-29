WORKING — weight formatter added and wired into the figure partial.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` (L26-L34). Under 1 kg returns whole grams (`850 g`); 1 kg and over returns one decimal (`12.5 kg`, `2.0 kg`).
- `templates/figure.php`: "Pack weight" row (L17) now echoes `esc_html( nexus_format_weight( $figure['weight_kg'] ) )`; the hard-coded ` kg` suffix is gone.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`).
- `npm test`: not run, no `package.json` in the repo.
- Helper spot-check via `php -r`, 8 inputs: `0.85` -> `850 g`, `0.4` -> `400 g`, `1.0` -> `1.0 kg`, `2.0` -> `2.0 kg`, `12.5` -> `12.5 kg`, `12.55` -> `12.6 kg`, `0` -> `0 g`, `0.9996` -> `1000 g`.
- Smoke render of `templates/figure.php` with `weight_kg => 0.85` under the compat escapers: `<dd>850 g</dd>`, title `<b>` escaped to `&lt;b&gt;`.

## Open questions
- Values just under 1 kg that round to 1000 g (e.g. `0.9996`) display as `1000 g`, not `1.0 kg`. The packet draws the line at 1 kg, so the helper compares the raw value; say the word if the threshold should apply after rounding.

NEXT: review and commit `inc/helpers.php` and `templates/figure.php`.
