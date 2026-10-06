# Q3 volatility / drawdown / target-vol — dev

## Next-week realised vol (log, annualised), weekly, pooled

| model | n | r2_oos | r2_vs_persistence | mae_log | spearman |
|---|---|---|---|---|---|
| persistence (last week RV) | 4073 | 0.448 | 0.000 | 0.301 | 0.718 |
| 4-week mean RV | 4073 | 0.467 | 0.034 | 0.298 | 0.698 |
| ridge | 4073 | 0.127 | -0.580 | 0.348 | 0.640 |
| lgbm | 4073 | 0.458 | 0.019 | 0.301 | 0.680 |

## Next-week drawdown > 10 % from entry (classification)

| model | n | auc | base_rate_dd10 |
|---|---|---|---|
| rv_now (baseline ranking) | 4073 | 0.656 | 0.366 |
| ridge predicted vol (ranking) | 4073 | 0.654 | 0.366 |
| logit | 4073 | 0.606 | 0.366 |
| lgbm | 4073 | 0.600 | 0.366 |
| shuffle | 4073 | 0.513 | 0.366 |

## Reconstructed M5-B100 arm with target-vol sizing (after costs, weekly)

| strategy | weeks | ann_ret | sharpe | maxdd | turnover_per_yr | avg_exposure | weeks_with_model_vol |
|---|---|---|---|---|---|---|---|
| M5-B100 (no sizing) | 300 | 1.424 | 1.646 | -0.437 | 15.759 | 0.676 |  |
| M5-B100 target-vol, realised vol | 300 | 0.773 | 1.611 | -0.323 | 13.928 | 0.473 |  |
| M5-B100 target-vol, model vol | 300 | 0.891 | 1.589 | -0.307 | 13.747 | 0.531 | 145.000 |
| BTC buy-and-hold | 300 | 0.581 | 1.075 | -0.752 | 0.000 | 1.000 |  |

Target vol 60% annualised, scale = min(1, target / basket vol).