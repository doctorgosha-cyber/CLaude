# Q2 calm regime — holdout

calm = RV72h < 90d median AND no 3σ 1h-shock in 72h AND 72h volume z < 2.

| horizon | rows | calm_share |
|---|---|---|
| 4h | 48086 | 0.354 |
| 1d | 7947 | 0.355 |
| 1w | 1099 | 0.473 |

## Predictability inside vs outside calm

| horizon | regime | model | n | hit | hit_ci95 | base_rate_up | auc | mean_fwd_ret | std_fwd_ret |
|---|---|---|---|---|---|---|---|---|---|
| 4h | calm | logit | 17003 | 0.521 | 0.008 | 0.493 | 0.531 | 0.000 | 0.012 |
| 4h | not_calm | logit | 31083 | 0.524 | 0.006 | 0.497 | 0.533 | 0.000 | 0.017 |
| 4h | calm | lgbm | 17003 | 0.524 | 0.008 | 0.493 | 0.534 | 0.000 | 0.012 |
| 4h | not_calm | lgbm | 31083 | 0.529 | 0.006 | 0.497 | 0.536 | 0.000 | 0.017 |
| 4h | calm | shuffle | 17003 | 0.491 | 0.008 | 0.493 | 0.496 | 0.000 | 0.012 |
| 4h | not_calm | shuffle | 31083 | 0.495 | 0.006 | 0.497 | 0.491 | 0.000 | 0.017 |
| 4h | calm | lgbm_calm_trained | 17003 | 0.521 | 0.008 | 0.493 | 0.526 | 0.000 | 0.012 |
| 4h | not_calm | lgbm_calm_trained | 31083 | 0.526 | 0.006 | 0.497 | 0.533 | 0.000 | 0.017 |
| 1d | calm | logit | 2825 | 0.532 | 0.018 | 0.507 | 0.536 | -0.000 | 0.031 |
| 1d | not_calm | logit | 5122 | 0.517 | 0.014 | 0.495 | 0.531 | 0.002 | 0.042 |
| 1d | calm | lgbm | 2825 | 0.504 | 0.018 | 0.507 | 0.499 | -0.000 | 0.031 |
| 1d | not_calm | lgbm | 5122 | 0.517 | 0.014 | 0.495 | 0.513 | 0.002 | 0.042 |
| 1d | calm | shuffle | 2825 | 0.480 | 0.018 | 0.507 | 0.486 | -0.000 | 0.031 |
| 1d | not_calm | shuffle | 5122 | 0.489 | 0.014 | 0.495 | 0.490 | 0.002 | 0.042 |
| 1d | calm | lgbm_calm_trained | 2825 | 0.501 | 0.018 | 0.507 | 0.515 | -0.000 | 0.031 |
| 1d | not_calm | lgbm_calm_trained | 5122 | 0.507 | 0.014 | 0.495 | 0.507 | 0.002 | 0.042 |
| 1w | calm | logit | 520 | 0.433 | 0.043 | 0.485 | 0.424 | 0.007 | 0.100 |
| 1w | not_calm | logit | 579 | 0.484 | 0.041 | 0.453 | 0.495 | 0.008 | 0.103 |
| 1w | calm | lgbm | 520 | 0.510 | 0.043 | 0.485 | 0.500 | 0.007 | 0.100 |
| 1w | not_calm | lgbm | 579 | 0.527 | 0.041 | 0.453 | 0.534 | 0.008 | 0.103 |
| 1w | calm | shuffle | 520 | 0.435 | 0.043 | 0.485 | 0.428 | 0.007 | 0.100 |
| 1w | not_calm | shuffle | 579 | 0.501 | 0.041 | 0.453 | 0.483 | 0.008 | 0.103 |
| 1w | calm | lgbm_calm_trained | 520 | 0.467 | 0.043 | 0.485 | 0.475 | 0.007 | 0.100 |
| 1w | not_calm | lgbm_calm_trained | 579 | 0.508 | 0.041 | 0.453 | 0.507 | 0.008 | 0.103 |

## Trade only inside calm windows (long/cash, thr 0.55)

| horizon | strategy | ann_ret | sharpe | maxdd | turnover_per_sym_yr | exposure | bh_ann_ret | bh_sharpe | bh_maxdd | periods |
|---|---|---|---|---|---|---|---|---|---|---|
| 4h | Q2 4h logit calm-only trade | -0.004 | -0.332 | -0.024 | 13.715 | 0.004 | 0.208 | 0.621 | -0.504 | 4384 |
| 4h | Q2 4h lgbm calm-only trade | -0.108 | -2.974 | -0.207 | 77.338 | 0.024 | 0.208 | 0.621 | -0.504 | 4384 |
| 1d | Q2 1d logit calm-only trade | -0.014 | -0.440 | -0.066 | 12.329 | 0.026 | 0.203 | 0.611 | -0.496 | 724 |
| 1d | Q2 1d lgbm calm-only trade | -0.030 | -0.452 | -0.117 | 25.161 | 0.067 | 0.203 | 0.611 | -0.496 | 724 |
| 1w | Q2 1w logit calm-only trade | -0.061 | -0.851 | -0.167 | 6.169 | 0.090 | 0.265 | 0.692 | -0.427 | 100 |
| 1w | Q2 1w lgbm calm-only trade | 0.039 | 0.353 | -0.115 | 4.444 | 0.071 | 0.265 | 0.692 | -0.427 | 100 |