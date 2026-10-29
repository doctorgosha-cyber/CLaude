WORKING — `nexus_get_rating` renamed to `nexus_rating_value`, behaviour unchanged.

Touched (5 files):
- inc/schema.php: definition and 1 call in `nexus_product_schema()`
- inc/helpers.php: 1 call in `nexus_rating_stars()`
- templates/review-card.php: 1 call
- templates/figure-rating.php: 1 call
- tests/test-rating.php: 2 calls

Not touched: functions.php (includes only, no reference).

Evidence:
- grep for the old name: 0 matches
- `php -l` clean on 6 files
- `php tests/test-rating.php`: ok, exit 0

NEXT: commit the rename.
