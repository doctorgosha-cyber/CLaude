WORKING — weight formatter added and wired into the figure partial.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` (L25-L36). Rounds to whole grams; under 1000 g returns `850 g`, otherwise `number_format( $kg, 1 )` + ` kg` (`12.5 kg`, `2.0 kg`). Tabs, `nexus_` prefix, docblock in the style of the file.
- `templates/figure.php`: "Pack weight" `<dd>` (L17) now echoes `esc_html( nexus_format_weight( $figure['weight_kg'] ) )`; the hard-coded ` kg` suffix is gone. No other lines touched.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`).
- Unit check via `php -r` on 8 values: `0.85` -> `850 g`, `0.4` -> `400 g`, `1` -> `1.0 kg`, `2` -> `2.0 kg`, `12.5` -> `12.5 kg`, `12.55` -> `12.6 kg`, `0.9996` -> `1.0 kg` (rounds to 1000 g, so takes the kg branch rather than printing `1000 g`).
- Rendered the partial under the PHP CLI with `inc/compat.php` for 3 weights (`0.85`, `2`, `12.5`): rows read `850 g`, `2.0 kg`, `12.5 kg`; title `A & B` escapes to `A &amp; B`.
- `npm test`: not run, no `package.json` in the repo.

## Open questions
- Rounding mode for the kg branch is PHP's `number_format()` half-up (`12.55` -> `12.6 kg`); packet did not specify, left as the simplest reading.
- Negative or zero weights are formatted as-is (`0 g`); no validation added since the packet did not ask for one.

NEXT: reviewer commits `inc/helpers.php` and `templates/figure.php`.
