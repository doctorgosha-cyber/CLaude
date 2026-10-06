# Q3 volatility / drawdown / target-vol — holdout

## Next-week realised vol (log, annualised), weekly, pooled

| model | n | r2_oos | r2_vs_persistence | mae_log | spearman |
|---|---|---|---|---|---|
| persistence (last week RV) | 1077 | 0.387 | 0.000 | 0.282 | 0.639 |
| 4-week mean RV | 1077 | 0.440 | 0.087 | 0.276 | 0.610 |
| ridge | 1077 | 0.532 | 0.237 | 0.250 | 0.672 |
| lgbm | 1077 | 0.486 | 0.161 | 0.266 | 0.634 |

## Next-week drawdown > 10 % from entry (classification)

| model | n | auc | base_rate_dd10 |
|---|---|---|---|
| rv_now (baseline ranking) | 1099 | 0.676 | 0.212 |
| ridge predicted vol (ranking) | 1077 | 0.704 | 0.214 |
| logit | 1099 | 0.650 | 0.212 |
| lgbm | 1099 | 0.633 | 0.212 |
| shuffle | 1099 | 0.461 | 0.212 |

## Reconstructed M5-B100 arm with target-vol sizing (after costs, weekly)

| strategy | weeks | ann_ret | sharpe | maxdd | turnover_per_yr | avg_exposure | weeks_with_model_vol |
|---|---|---|---|---|---|---|---|
| M5-B100 (no sizing) | 49 | 0.233 | 0.981 | -0.069 | 8.023 | 0.224 |  |
| M5-B100 target-vol, realised vol | 49 | 0.262 | 1.224 | -0.063 | 7.210 | 0.181 |  |
| M5-B100 target-vol, model vol | 49 | 0.239 | 1.043 | -0.062 | 8.073 | 0.213 | 6.000 |
| BTC buy-and-hold | 49 | -0.112 | -0.079 | -0.426 | 0.000 | 1.000 |  |

Target vol 60% annualised, scale = min(1, target / basket vol).