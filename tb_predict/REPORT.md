# TB-PREDICT — can volumes + indicators predict crypto moves in calm markets?

**Short answer: no tradeable direction edge; calm windows do not help; volatility and
drawdown risk are predictable but mostly by last week's volatility itself.** Nothing
passes the preregistered holdout + Deflated Sharpe test. No new alpha arm is proposed.
One risk-side overlay (realised-vol sizing of M5-B100) cut max drawdown in both periods
and is specified below as an optional paper experiment, not as an edge.

Setup (details in PREREG.md): Binance spot 1h klines 2019-01 .. 2026-10-03 for BTC, ETH
and 20 fixed alts (XMR kept although delisted), from two public GitHub mirrors because the
Binance hosts are blocked from the research box; the mirrors agree bar-for-bar. OHLCV only
(no taker-buy ratio, no funding, no trade count). 37 price/volume features, logistic
regression and LightGBM with fixed parameters, pooled across symbols, rolling 3-year
training, quarterly refits, 1-horizon purge + 7-day embargo. Costs 0.15 %/side. Shuffled
labels as control. Development OOS = 2020-01 .. 2025-09. Holdout, read once:
2025-10-01 .. 2026-10-03 for the 10 symbols with data to 2026 (BTC, ETH, BNB, XRP, ADA,
TRX, DOGE, ZEC, BCH, SOL; BTC fell 25 % in that year) plus 2023-03-15 .. 2024-03-14 for the
12 alts whose mirror ends there. 23 trading variants counted for the DSR.

## Q1 Direction — does not work after costs
| horizon | model | dev AUC | holdout AUC | holdout hit | shuffle AUC | strat Sharpe (holdout) | B&H Sharpe |
|---|---|---|---|---|---|---|---|
| 4h | LightGBM | 0.545 | 0.535 | 52.7 % ±0.4 | 0.49 | −2.14 | 0.62 |
| 1d | logit | 0.529 | 0.531 | 52.3 % ±1.1 | 0.49 | 0.43 | 0.61 |
| 1d | LightGBM | 0.536 | 0.508 | 51.2 % ±1.1 | 0.49 | 0.10 | 0.61 |
| 1w | LightGBM | 0.519 | 0.519 | 51.9 % ±3.0 | 0.46 | 0.26 | 0.69 |
There is a real but tiny signal at 4h and 1d (AUC ≈ 0.53, control ≈ 0.49, 48k holdout
rows), driven by alts; for BTC and ETH alone the holdout AUC is 0.43–0.53, i.e. nothing.
It is far too small to pay 0.3 % per round trip: every long/cash variant (thresholds 0.50
and 0.55) trails equal-weight buy-and-hold on Sharpe in the holdout, 4h variants lose
8–31 %/yr, and all DSR values are ≤ 0.01 (benchmark SR0 ≈ 2.1 for 23 trials). The best
development result (1d LightGBM, Sharpe 1.32 vs B&H 1.28, DSR 0.45) did not survive
(holdout Sharpe 0.10). Weekly direction is indistinguishable from chance.

## Q2 Calm regime — does not help
Calm (RV72h below 90-day median, no 3σ 1h shock in 72h, 72h volume z < 2) covers 35–48 %
of bars. Holdout AUC inside vs outside calm: 4h 0.534 vs 0.536, 1d 0.499 vs 0.513
(LightGBM) and 0.536 vs 0.531 (logit), 1w 0.500 vs 0.534. The development hint at 1w
(0.54 vs 0.50) reversed. Training on calm bars only is worse everywhere. Trading only in
calm windows loses money at every horizon (holdout Sharpe −3.0 .. +0.35, exposure < 10 %).
Calm bars simply have half the return variance and no extra predictability.

## Q3 Volatility and drawdown — predictable, but the model adds little
| next-week RV (log) | dev R² vs persistence | holdout R² vs persistence | holdout Spearman |
|---|---|---|---|
| persistence (last week) | 0 | 0 | 0.64 |
| 4-week mean | +0.03 | +0.09 | 0.61 |
| ridge | −0.58 (unstable early) | +0.24 | 0.67 |
| LightGBM | +0.02 | +0.16 | 0.63 |
Volatility level is highly persistent (OOS R² 0.39–0.45 from last week alone). The models
beat persistence on the holdout but not consistently in development, so the preregistered
"+0.05 on holdout" is met only nominally; the practical gain over a 4-week mean is small.
Drawdown risk (next-week drawdown > 10 % from entry, base rate 21–37 %): ranking by current
RV gives AUC 0.66 dev / 0.68 holdout; by ridge-forecast RV 0.65 / 0.70; the LightGBM
classifier is worse (0.60 / 0.63); shuffle 0.51 / 0.46. Vol is the whole story.
Target-vol sizing of the reconstructed M5-B100 arm (70 % top-5 4-week-momentum alts when
BTC > EMA200 + 30 % BTC when > EMA100, weekly, 60 % vol target, no leverage):
| M5-B100 (after costs) | dev Sharpe | dev MaxDD | holdout Sharpe | holdout MaxDD | holdout ann. ret |
|---|---|---|---|---|---|
| no sizing | 1.65 | −44 % | 0.98 | −6.9 % | 23 % |
| sized by realised vol | 1.61 | −32 % | 1.22 | −6.3 % | 26 % |
| sized by model vol | 1.59 | −31 % | 1.04 | −6.2 % | 24 % |
MaxDD improves in both periods; Sharpe is flat in development (−0.04) and better in the
holdout (49 weeks, mostly risk-off, DSR 0.16). This fails the strict "both Sharpe and MaxDD
in both periods" rule by a hair and is not an edge; it is a drawdown control that costs
return in bull years (dev annual return 142 % → 77 %). Model vol adds nothing over realised.

## Q4 Cross-sectional ranking — does not beat plain momentum
Weekly rank-IC vs next-week return over 20 alts: 4-week momentum −0.02 dev / −0.05 holdout,
LightGBM expected return +0.03 / +0.02 (t < 1.1), logit 0.02 / 0.00, blend 0.01 / −0.02.
All are noise. Top-5 equal-weight after costs, holdout: momentum Sharpe 0.81, LightGBM 0.46,
logit 0.35, blend 0.74, all-alts equal weight 0.73. Momentum's IC is negative yet its top-5
portfolio still wins because weekly winners carry fat right tails; the model does not
capture that. No ranking variant passes the DSR (≤ 0.03).

## What survives → nothing as alpha. Optional paper-only risk overlay (not an edge claim)
**M5-B100-TV**: identical rules to M5-B100; at each Monday 00:00 UTC rebalance compute for
every coin to be held its annualised realised vol of 1h log returns over the last 168 bars;
basket vol = equal-weight mean; scale all target weights by min(1, 0.60 / basket vol); rest
in cash; no leverage, no other change; costs as in the bot. Expect lower return, lower MaxDD,
Sharpe roughly unchanged. Run it as a paper arm beside M5-B100 for ≥ 26 weeks before any
decision. Everything else in this brief (direction models, calm filters, ML ranking, model
vol) should not be built into the bot.

## Caveats
Holdout year was risk-off (BTC −25 %) and covers only 10 symbols; the alt holdout is 2023-24.
Taker-buy ratio and funding were unavailable, so the "volume" leg is base volume only.
M5-B100 is a reconstruction from the brief, not the bot's code. Tables: `tables/*.md`.
