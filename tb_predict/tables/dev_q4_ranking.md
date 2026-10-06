# Q4 cross-sectional ranking of the 20 alts, weekly — dev

## Rank information coefficient (Spearman, score vs next-week return)

| score | weeks | mean_rank_ic | ic_tstat | pct_weeks_ic_pos |
|---|---|---|---|---|
| 4-week momentum | 261 | -0.022 | -0.968 | 0.437 |
| lgbm expected return | 261 | 0.025 | 1.087 | 0.517 |
| logit P(up) | 261 | 0.018 | 0.776 | 0.513 |
| blend mom+lgbm | 261 | 0.006 | 0.290 | 0.498 |

## Top-5 equal-weight long-only, weekly rebalance, after costs

| score | weeks | ann_ret | sharpe | maxdd | turnover_per_yr |
|---|---|---|---|---|---|
| 4-week momentum | 261 | 1.498 | 1.421 | -0.797 | 27.853 |
| lgbm expected return | 261 | 0.721 | 1.063 | -0.790 | 36.699 |
| logit P(up) | 261 | 0.557 | 0.950 | -0.860 | 23.789 |
| blend mom+lgbm | 261 | 1.018 | 1.230 | -0.840 | 39.488 |
| equal-weight all alts (B&H, no costs) | 261 | 0.966 | 1.231 | -0.805 | 0.000 |