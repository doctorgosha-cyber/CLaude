## Task
Rename the helper `nexus_get_rating` to `nexus_rating_value` everywhere in the theme (definition, every call site, the test), so the name matches the `nexus_<topic>_<thing>` convention. Behaviour is unchanged.

## Inputs
- functions.php
- inc/*.php
- templates/*.php
- tests/test-rating.php

## Deliverables
- the renamed function and every updated file
- REPORT.md: every file you touched, by path

## Notes
Budget: 10 minutes. `php tests/test-rating.php` must still pass.
