WORKING — weight formatter added and wired into the figure partial.

Changed:
- inc/helpers.php: new `nexus_format_weight( float $kg ): string` (grams under 1 kg, else one decimal + " kg")
- templates/figure.php: "Pack weight" row now echoes `esc_html( nexus_format_weight( (float) $figure['weight_kg'] ) )`; the literal " kg" suffix was removed so it is not doubled

Evidence:
- `php -l` clean on 2 files
- CLI check: 12.5 → `12.5 kg`, 0.85 → `850 g`, 2 → `2.0 kg` (3 cases)

Open questions: none.

NEXT: review and commit the 2 files.
