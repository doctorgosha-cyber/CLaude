# PREREG — TB-PREDICT preregistration (frozen 2026-10-06, before any holdout look)

Holdout data (2025-10-01 .. 2026-10-03 for the 10 extended symbols; 2023-03-15 ..
2024-03-14 for the 12 alts whose mirror ends in 2024-03) were masked out of
every table, print-out and training set during development. They are read
exactly once, by `python run.py --holdout`, after this file was committed.

## Data
* Binance spot 1h klines via two public GitHub mirrors of data.binance.vision
  (the Binance hosts are blocked from the research box): mdeacey/binance-crypto-
  coins-prices (2017-08 .. 2024-03-14, 234 pairs) and Speirsy11/crypto-dataset
  (.. 2026-10-03, 10 pairs). On the 31k–57k overlapping bars per symbol the two
  mirrors agree to the last decimal (see data/BUILD_LOG.txt).
* Fields: open, high, low, close, base volume. **Not available**: taker-buy
  ratio, trade count, funding. These brief features are therefore omitted.
* Universe (fixed before any modelling): BTC, ETH + 20 alts BNB XRP ADA LTC BCH
  EOS XLM TRX LINK ETC XMR NEO ATOM VET DOGE MATIC ALGO XTZ ZEC SOL. XMR
  (delisted 2024-02) is kept as the survivorship control. No other delisted
  pair with 2019 history was available in the mirrors.
* Range 2019-01-01 .. 2026-10-03; development OOS = 2020-01-01 .. 2025-09-30.

## Targets
* Direction: sign of next bar close-to-close log return at 4h, 1d, 1w (weekly
  bars open Monday 00:00 UTC = the bot's rebalance time). Decision at bar close.
* Q3: next-week annualised realised vol of 1h returns (log target); next-week
  max drawdown from entry close < −10 % (classification).
* Q4: next-week log return of each alt, ranked cross-sectionally.

## Features (price/volume only, same list at every horizon, computed on bars of
that horizon): log returns over 1,2,3,5,10,20,60 bars; RSI14; MACD/price; MACD
hist/price; Bollinger %b and width (20); ATR14/price; realised vol 5/20/60 and
ratio; distance to EMA50/EMA200; bar range; log-volume z-scores (20, 60) and
5-bar change; OBV slope 10/30; 20-bar return/volume correlation; 20-bar skew;
distance to 20-bar high/low; BTC features (ret 1/5/20, rv20, RSI14, EMA200
distance, volume z) for all rows; is_alt flag. 37 features.

## Calm regime (Q2), from 1h data at decision time
calm = RV(72h) < rolling 90-day median of RV(72h)
   AND no |1h return| > 3·σ(30d) in the last 72h
   AND z-score of 72h mean volume vs 30-day mean < 2.

## Models and protocol
* Logistic regression (standardised, L2, C=0.1) and LightGBM (300 trees,
  lr 0.03, 15 leaves, depth 4, min_child 200, subsample/colsample 0.8, λ=5).
  Parameters fixed a priori; never tuned on test blocks. No sequence model
  (optional in the brief; not attempted — counted as 0 trials).
* Pooled across symbols. Walk-forward: rolling 3-year train window, refit each
  calendar quarter, predict that quarter. Purge = 1 horizon, embargo = 7 days.
* Shuffled-label control: LightGBM refit on permuted labels in every block;
  must score ≈ 50 % hit / 0.50 AUC.
* Costs: 0.1 % fee + 0.05 % slippage per side (0.15 %/side) on every position
  change; turnover reported as position changes per symbol-year.
* Trading rule for Q1/Q2: long when P(up) > 0.55, else cash (spot bot; no
  shorting). Equal-weight across symbols with a prediction. Benchmark:
  equal-weight buy-and-hold of the same symbols, and BTC buy-and-hold.

## Variants (all counted; N feeds the Deflated Sharpe Ratio)
Q1  direction, trading strategies: 3 horizons × 2 models × 2 thresholds
    (0.55 primary, 0.50 secondary) = 12
Q2  calm: (a) same Q1 models evaluated inside vs outside calm (no new trial);
    (b) trade only in calm windows, 3 horizons × 2 models = 6;
    (c) calm-only training set, LightGBM, 3 horizons = 3 (metrics only)
Q3  vol: ridge + LightGBM regression vs persistence and 4-week mean baselines
    (metrics only); drawdown classifier logit + LightGBM (metrics only);
    target-vol sizing of the M5-B100 arm with realised vol and with model vol
    = 2 trading strategies
Q4  weekly ranking of the 20 alts: 4-week momentum (benchmark), LightGBM
    expected return, logistic P(up), 50/50 rank blend; top-5 equal weight
    long-only = 3 new trading strategies + benchmark
Total trading strategies N = 12 + 6 + 2 + 4 = 24. DSR benchmark SR0 is computed
from the empirical variance of the per-period Sharpe over these 24 trials.

## M5-B100 arm (reconstruction used for Q3)
Weekly, Monday 00:00 UTC. 70 % momentum sleeve: top-5 alts by 4-week return,
equal weight, only while BTC daily close > EMA200 (else cash). 30 % BTC sleeve:
long BTC while daily close > EMA100, else cash. Target-vol: exposure scale =
min(1, 0.60 / predicted annualised vol of the held basket), no leverage.

## Success criteria (decided now)
* Direction "works" only if, on the holdout: AUC ≥ 0.53 AND the after-cost
  long/cash strategy beats equal-weight buy-and-hold on Sharpe AND the DSR of
  that strategy across N=24 trials is ≥ 0.95. Hit rate alone is not evidence
  (the up/down base rate drifts with the market).
* Calm "helps" only if AUC inside calm exceeds AUC outside by ≥ 0.02 on both
  development and holdout with ≥ 1,000 holdout rows.
* Vol "works" if OOS R² of the model vs persistence improves by ≥ 0.05 on the
  holdout; target-vol sizing "works" if it improves both Sharpe and MaxDD of
  M5-B100 after costs on development and holdout.
* Ranking "works" if the mean weekly rank-IC of the model exceeds that of
  4-week momentum on both development and holdout, and the top-5 Sharpe after
  costs is higher.
A result that passes on development but fails on the holdout is reported as
"does not work".

## Amendments made during development (all before the holdout run)
* 2026-10-06 13:40 UTC — minimum training rows made horizon-specific (4h 5000,
  1d 1500, 1w 400): with a flat 2000 the weekly walk-forward could not start
  before mid-2022. DSR trial variance is now computed in annualised units
  (per-period Sharpe of 4h and weekly strategies are not comparable).
  Q3 drawdown table gains one metrics-only row: ranking by the ridge vol
  forecast. No trading strategy was added; N stays 24 (23 realised: the
  momentum benchmark in Q4 is not counted as a trial).
