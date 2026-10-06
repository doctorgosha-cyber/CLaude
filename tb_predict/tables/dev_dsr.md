# Deflated Sharpe Ratio — dev

N = 23 trading-strategy trials (prereg: 24). SR0 = expected max Sharpe of N unskilled trials given the empirical trial variance. DSR = P(true Sharpe > SR0) after skew/kurtosis correction.

| strategy | sharpe_ann | periods | dsr | sr0_ann |
|---|---|---|---|---|
| Q1 4h logit thr0.55 | 0.071 | 12600 | 0.001 | 1.370 |
| Q1 4h logit thr0.5 | -0.143 | 12600 | 0.000 | 1.370 |
| Q1 4h lgbm thr0.55 | -0.046 | 12600 | 0.000 | 1.370 |
| Q1 4h lgbm thr0.5 | -0.376 | 12600 | 0.000 | 1.370 |
| Q1 1d logit thr0.55 | 0.986 | 2100 | 0.166 | 1.370 |
| Q1 1d logit thr0.5 | 0.894 | 2100 | 0.126 | 1.370 |
| Q1 1d lgbm thr0.55 | 1.322 | 2100 | 0.451 | 1.370 |
| Q1 1d lgbm thr0.5 | 0.886 | 2100 | 0.127 | 1.370 |
| Q1 1w logit thr0.55 | 0.105 | 261 | 0.002 | 1.370 |
| Q1 1w logit thr0.5 | 0.220 | 261 | 0.005 | 1.370 |
| Q1 1w lgbm thr0.55 | 0.814 | 261 | 0.090 | 1.370 |
| Q1 1w lgbm thr0.5 | 0.825 | 261 | 0.095 | 1.370 |
| Q2 4h logit calm-only trade | -0.245 | 12600 | 0.000 | 1.370 |
| Q2 4h lgbm calm-only trade | -1.098 | 12600 | 0.000 | 1.370 |
| Q2 1d logit calm-only trade | -0.272 | 2100 | 0.000 | 1.370 |
| Q2 1d lgbm calm-only trade | 0.157 | 2100 | 0.002 | 1.370 |
| Q2 1w logit calm-only trade | 0.148 | 261 | 0.003 | 1.370 |
| Q2 1w lgbm calm-only trade | 0.523 | 261 | 0.024 | 1.370 |
| Q3 M5-B100 target-vol, realised vol | 1.611 | 300 | 0.744 | 1.370 |
| Q3 M5-B100 target-vol, model vol | 1.589 | 300 | 0.715 | 1.370 |
| Q4 top5 lgbm expected return | 1.063 | 261 | 0.239 | 1.370 |
| Q4 top5 logit P(up) | 0.950 | 261 | 0.170 | 1.370 |
| Q4 top5 blend mom+lgbm | 1.230 | 261 | 0.371 | 1.370 |