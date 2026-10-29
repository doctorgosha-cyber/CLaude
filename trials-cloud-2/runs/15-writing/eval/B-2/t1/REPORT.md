WORKING — weight formatter added and wired into the figure partial.

## What changed
- `inc/helpers.php`: new `nexus_format_weight( float $kg ): string` appended after `nexus_kind_label()` (L26–L36). Rounds to whole grams; under 1000 g returns `850 g`, otherwise `number_format( $kg, 1 )` with ` kg` (`12.5 kg`, `2.0 kg`). Rounding on grams first means `0.9996` kg shows as `1.0 kg`, never `1000 g`.
- `templates/figure.php`: the "Pack weight" `<dd>` (L17) now echoes `esc_html( nexus_format_weight( $figure['weight_kg'] ) )`; the hard-coded ` kg` suffix is gone.

## Evidence
- `php -l` clean on 2 files (`inc/helpers.php`, `templates/figure.php`), before and after the change.
- `php -r` smoke test on 7 values: `0.4` → `400 g`, `0.85` → `850 g`, `0.9996` → `1.0 kg`, `1` → `1.0 kg`, `2` → `2.0 kg`, `12.5` → `12.5 kg`, `12.55` → `12.6 kg`.
- Template rendered under the PHP CLI with `inc/compat.php` for 2 fixtures: `weight_kg => 0.85` outputs `<dd>850 g</dd>`, `weight_kg => 2` outputs `<dd>2.0 kg</dd>`.
- No `package.json` in the run directory, so `npm test` not applicable.
- Render time: not measured.

## Open questions
- Negative or zero weights are formatted as-is (`0 g`); the packet gives no rule, so no guard was added.
- `number_format()` rounds half up at one decimal (`12.55` → `12.6 kg`); confirm this matches the catalogue's own rounding if weights are later sourced from `data/foods.json`.

NEXT: call `nexus_format_weight()` from any other template that still prints `weight_kg` raw once those templates exist in the stripped theme.
