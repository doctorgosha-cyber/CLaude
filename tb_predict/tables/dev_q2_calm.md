# Q2 calm regime — dev

calm = RV72h < 90d median AND no 3σ 1h-shock in 72h AND 72h volume z < 2.

| horizon | rows | calm_share |
|---|---|---|
| 4h | 208769 | 0.374 |
| 1d | 34719 | 0.376 |
| 1w | 4073 | 0.468 |

## Predictability inside vs outside calm

| horizon | regime | model | n | hit | hit_ci95 | base_rate_up | auc | mean_fwd_ret | std_fwd_ret |
|---|---|---|---|---|---|---|---|---|---|
| 4h | calm | logit | 78013 | 0.522 | 0.004 | 0.502 | 0.530 | 0.000 | 0.017 |
| 4h | not_calm | logit | 130756 | 0.526 | 0.003 | 0.511 | 0.536 | 0.001 | 0.026 |
| 4h | calm | lgbm | 78013 | 0.530 | 0.004 | 0.502 | 0.540 | 0.000 | 0.017 |
| 4h | not_calm | lgbm | 130756 | 0.535 | 0.003 | 0.511 | 0.548 | 0.001 | 0.026 |
| 4h | calm | shuffle | 78013 | 0.499 | 0.004 | 0.502 | 0.499 | 0.000 | 0.017 |
| 4h | not_calm | shuffle | 130756 | 0.499 | 0.003 | 0.511 | 0.497 | 0.001 | 0.026 |
| 4h | calm | lgbm_calm_trained | 78013 | 0.527 | 0.004 | 0.502 | 0.533 | 0.000 | 0.017 |
| 4h | not_calm | lgbm_calm_trained | 130756 | 0.524 | 0.003 | 0.511 | 0.532 | 0.001 | 0.026 |
| 1d | calm | logit | 13037 | 0.509 | 0.009 | 0.502 | 0.508 | 0.000 | 0.045 |
| 1d | not_calm | logit | 21682 | 0.532 | 0.007 | 0.523 | 0.540 | 0.004 | 0.069 |
| 1d | calm | lgbm | 13037 | 0.514 | 0.009 | 0.502 | 0.520 | 0.000 | 0.045 |
| 1d | not_calm | lgbm | 21682 | 0.525 | 0.007 | 0.523 | 0.544 | 0.004 | 0.069 |
| 1d | calm | shuffle | 13037 | 0.491 | 0.009 | 0.502 | 0.484 | 0.000 | 0.045 |
| 1d | not_calm | shuffle | 21682 | 0.505 | 0.007 | 0.523 | 0.496 | 0.004 | 0.069 |
| 1d | calm | lgbm_calm_trained | 13037 | 0.508 | 0.009 | 0.502 | 0.511 | 0.000 | 0.045 |
| 1d | not_calm | lgbm_calm_trained | 21682 | 0.514 | 0.007 | 0.523 | 0.523 | 0.004 | 0.069 |
| 1w | calm | logit | 1905 | 0.485 | 0.022 | 0.495 | 0.470 | 0.012 | 0.132 |
| 1w | not_calm | logit | 2168 | 0.466 | 0.021 | 0.512 | 0.470 | 0.024 | 0.202 |
| 1w | calm | lgbm | 1905 | 0.527 | 0.022 | 0.495 | 0.542 | 0.012 | 0.132 |
| 1w | not_calm | lgbm | 2168 | 0.507 | 0.021 | 0.512 | 0.499 | 0.024 | 0.202 |
| 1w | calm | shuffle | 1905 | 0.517 | 0.022 | 0.495 | 0.515 | 0.012 | 0.132 |
| 1w | not_calm | shuffle | 2168 | 0.496 | 0.021 | 0.512 | 0.485 | 0.024 | 0.202 |
| 1w | calm | lgbm_calm_trained | 1602 | 0.481 | 0.024 | 0.494 | 0.472 | 0.008 | 0.116 |
| 1w | not_calm | lgbm_calm_trained | 1673 | 0.478 | 0.024 | 0.488 | 0.469 | 0.005 | 0.132 |

## Trade only inside calm windows (long/cash, thr 0.55)

| horizon | strategy | ann_ret | sharpe | maxdd | turnover_per_sym_yr | exposure | bh_ann_ret | bh_sharpe | bh_maxdd | periods |
|---|---|---|---|---|---|---|---|---|---|---|
| 4h | Q2 4h logit calm-only trade | -0.021 | -0.245 | -0.187 | 64.784 | 0.020 | 0.942 | 1.242 | -0.790 | 12600 |
| 4h | Q2 4h lgbm calm-only trade | -0.129 | -1.098 | -0.558 | 167.663 | 0.054 | 0.942 | 1.242 | -0.790 | 12600 |
| 1d | Q2 1d logit calm-only trade | -0.033 | -0.272 | -0.361 | 24.191 | 0.047 | 0.993 | 1.278 | -0.783 | 2100 |
| 1d | Q2 1d lgbm calm-only trade | 0.012 | 0.157 | -0.347 | 35.852 | 0.079 | 0.993 | 1.278 | -0.783 | 2100 |
| 1w | Q2 1w logit calm-only trade | 0.011 | 0.148 | -0.306 | 6.575 | 0.103 | 0.924 | 1.225 | -0.793 | 261 |
| 1w | Q2 1w lgbm calm-only trade | 0.100 | 0.523 | -0.294 | 9.346 | 0.127 | 0.924 | 1.225 | -0.793 | 261 |