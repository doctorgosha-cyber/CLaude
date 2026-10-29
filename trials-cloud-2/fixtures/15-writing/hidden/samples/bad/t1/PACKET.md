## Task
Add a weight formatter to the theme helpers and use it in the figure partial. Packs under 1 kg are shown in grams (`850 g`), packs of 1 kg and over in kilograms with one decimal (`12.5 kg`, `2.0 kg`).

## Inputs
- inc/helpers.php
- templates/figure.php
- inc/compat.php

## Deliverables
- inc/helpers.php: new function `nexus_format_weight( float $kg ): string`
- templates/figure.php: the "Pack weight" row uses the new helper
- REPORT.md

## Notes
Budget: 10 minutes.
