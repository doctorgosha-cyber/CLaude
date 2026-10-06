# Deflated Sharpe Ratio — holdout

N = 23 trading-strategy trials (prereg: 24). SR0 = expected max Sharpe of N unskilled trials given the empirical trial variance. DSR = P(true Sharpe > SR0) after skew/kurtosis correction.

| strategy | sharpe_ann | periods | dsr | sr0_ann |
|---|---|---|---|---|
| Q1 4h logit thr0.55 | -0.840 | 4384 | 0.000 | 2.098 |
| Q1 4h logit thr0.5 | -1.854 | 4384 | 0.000 | 2.098 |
| Q1 4h lgbm thr0.55 | -2.140 | 4384 | 0.000 | 2.098 |
| Q1 4h lgbm thr0.5 | -1.956 | 4384 | 0.000 | 2.098 |
| Q1 1d logit thr0.55 | 0.425 | 724 | 0.010 | 2.098 |
| Q1 1d logit thr0.5 | 0.342 | 724 | 0.007 | 2.098 |
| Q1 1d lgbm thr0.55 | 0.103 | 724 | 0.002 | 2.098 |
| Q1 1d lgbm thr0.5 | 0.281 | 724 | 0.005 | 2.098 |
| Q1 1w logit thr0.55 | -0.618 | 100 | 0.000 | 2.098 |
| Q1 1w logit thr0.5 | -0.141 | 100 | 0.001 | 2.098 |
| Q1 1w lgbm thr0.55 | 0.257 | 100 | 0.004 | 2.098 |
| Q1 1w lgbm thr0.5 | 0.266 | 100 | 0.005 | 2.098 |
| Q2 4h logit calm-only trade | -0.332 | 4384 | 0.000 | 2.098 |
| Q2 4h lgbm calm-only trade | -2.974 | 4384 | 0.000 | 2.098 |
| Q2 1d logit calm-only trade | -0.440 | 724 | 0.000 | 2.098 |
| Q2 1d lgbm calm-only trade | -0.452 | 724 | 0.000 | 2.098 |
| Q2 1w logit calm-only trade | -0.851 | 100 | 0.000 | 2.098 |
| Q2 1w lgbm calm-only trade | 0.353 | 100 | 0.003 | 2.098 |
| Q3 M5-B100 target-vol, realised vol | 1.224 | 49 | 0.156 | 2.098 |
| Q3 M5-B100 target-vol, model vol | 1.043 | 49 | 0.126 | 2.098 |
| Q4 top5 lgbm expected return | 0.458 | 100 | 0.008 | 2.098 |
| Q4 top5 logit P(up) | 0.349 | 100 | 0.007 | 2.098 |
| Q4 top5 blend mom+lgbm | 0.744 | 100 | 0.027 | 2.098 |