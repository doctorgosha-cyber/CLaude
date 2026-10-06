# Q4 cross-sectional ranking of the 20 alts, weekly — holdout

## Rank information coefficient (Spearman, score vs next-week return)

| score | weeks | mean_rank_ic | ic_tstat | pct_weeks_ic_pos |
|---|---|---|---|---|
| 4-week momentum | 100 | -0.051 | -1.382 | 0.420 |
| lgbm expected return | 100 | 0.015 | 0.389 | 0.540 |
| logit P(up) | 100 | -0.003 | -0.070 | 0.480 |
| blend mom+lgbm | 100 | -0.024 | -0.652 | 0.440 |

## Top-5 equal-weight long-only, weekly rebalance, after costs

| score | weeks | ann_ret | sharpe | maxdd | turnover_per_yr |
|---|---|---|---|---|---|
| 4-week momentum | 100 | 0.352 | 0.807 | -0.459 | 26.728 |
| lgbm expected return | 100 | 0.118 | 0.458 | -0.449 | 31.928 |
| logit P(up) | 100 | 0.050 | 0.349 | -0.491 | 25.896 |
| blend mom+lgbm | 100 | 0.298 | 0.744 | -0.394 | 34.216 |
| equal-weight all alts (B&H, no costs) | 100 | 0.297 | 0.731 | -0.415 | 0.000 |