# TB-DIP preregistration (written 2026-10-07 before any rule was run on any data)

## Disclosure before registration
- I had already seen the BTC daily close sampled every 60 days for the whole file, holdout included: ~122k at 2025-10, ~58k at 2026-06, ~85k at 2026-10-03.
- I had read TB-BRAIN's description of the market state on 2026-10-03.
- No rule, indicator or episode result had been computed on any period when this file was written.
- The coarse holdout path is known, so a reader should treat the holdout as **not fully blind to the price path**. It is blind to every rule's result.

## Question
Does a preregistered rule for deploying the 300 USDT reserve into BTC (version A), or separately into the tier-2 basket (version B), beat both of these, out of sample and after costs?
- (i) keeping the reserve in cash;
- (ii) deploying it on day 1.

## Data and splits
- **Data:** `projects/trading-bot/data/daily/<PAIR>.json` (rows `[openMs, close, quoteVolume]`, UTC days). BTCUSDT runs from 2020-06-01 to 2026-10-03, 2316 days, no gaps.
- **DEV:** 2020-06-01 … 2025-10-03. Indicators warm up on 2020 data. Dev episodes start on 2021-01-01.
- **HOLDOUT:** 2025-10-04 … 2026-10-03, the last 12 months.
  - The dev phase is run on arrays **truncated at 2025-10-03**, so dev code cannot read the holdout.
  - The holdout phase runs **once**. It refuses to start unless `prereg-lock.json` holds this file's sha256. It writes `holdout-results.json` and refuses to overwrite it.

## Episodes (the unit of analysis)
- The reserve (300 USDT) appears at the close of a decision day *s*.
- **Dev starts:** the 1st of every month, 2021-01-01 … 2025-09-01 (57 episodes). The end is min(*s* + 365 d, 2025-10-03).
- **Holdout starts:** 2025-10-04, then the 1st of every month 2025-11-01 … 2026-09-01 (12 episodes). Every holdout episode ends on 2026-10-03.
- **Execution:** the decision uses closes ≤ *t*, and the fill is at the close of *t* + 1. A buy fills at close × 1.0005 (slippage 0.05 %) and pays a 0.1 % fee on the notional. A sell fills at close × 0.9995 and pays 0.1 %.
- **Valuation:** the episode value is cash + holdings × close on the end day (mark, no exit cost). It is reported as excess over each benchmark in % of 300.
- **Benchmarks:**
  - **CASH:** 300 constant, 0 % yield.
  - **DAY1:** buy everything at the close of *s* + 1, then hold.

## Rule families (BTC signals for both versions; count of variants)
Indicators are computed on BTC closes from 2020-06-01 onward, recursively:
- EMA200 is seeded with the SMA of the first 200 closes.
- RSI14 is the simple-average RSI, the same as `src/indicators.mjs`.

| Family | Trigger at close *t* | Parameters | Variants |
|---|---|---|---|
| F1 drawdown | close / max(close over the last L days incl. *t*) − 1 ≤ −X % | L ∈ {90, 180}; X ∈ {15, 25, 35}; sizing ∈ {ALL, 3 tranches of 1/3 at X, X+10, X+20} | 12 |
| F2 trend+RSI | close ≤ EMA200 × (1 − Y %) AND RSI14 < 30 | Y ∈ {0, 10, 20} | 3 |
| F3 capitulation | ln(c_t / c_{t−1}) ≤ −Z · σ90, where σ90 = std of daily log returns over *t*−90 … *t*−1, AND volume z ≥ 2 (z of ln(quote vol) vs *t*−30 … *t*−1) | Z ∈ {3, 4} | 2 |
| F4 DCA benchmark | first close < EMA200 → buy reserve/n every 7 days, n slices | n ∈ {8, 16} weeks | 2 |

**Exits.** Each variant has two exits, which doubles the count to **38 variants per version and 76 in total.**
- NONE: hold to the episode end.
- EMA: when holding and close ≥ 1.10 × EMA200, sell everything at *t* + 1. The rule then re-arms, so tranches reset and DCA stops.

**Version B, the tier-2 basket.** The BTC signal decides when to buy. The money goes into an equal-weight basket fixed at decision time:
- Take the point-in-time 90-day median quote-volume ranks (bot `volumeRanks`, stable-like pairs excluded).
- Remove stablecoins, fiat and gold tokens (metadata), leveraged bases (bot `isLeveragedBase`), meme-tagged metadata and pairs listed for fewer than 365 days.
- Drop BTC and take the top 40. Positions 11–40 without ETH form the basket.
- Only pairs that traded on *t* are bought. A pair that later stops trading is marked at its last close. This is a survivorship bias in the basket's favour; the delisted count is reported.
- DAY1-B buys the same kind of basket at *s* + 1.

## Selection, walk-forward and decision
- **Selection objective:** the highest mean excess vs DAY1 among variants with mean excess vs CASH ≥ 0. If no variant qualifies, the selection is "no rule" (= cash).
- **Walk-forward on DEV (anchored):** the test folds are 2022, 2023, 2024 and 2025-01…09.
  - Training episodes start before the fold and end at min(*s* + 365, fold start − 1 d).
  - The selected variant is scored on the fold's episodes.
- **The holdout variant** = the selection on all DEV episodes. Only this one variant decides; the other variants' holdout numbers are context only.
- **Bootstrap:** moving-block bootstrap over episodes in start order. Block 3 for the holdout, 6 for dev. 10 000 resamples, seed 20261007, 95 % percentile CI.
- **Deflated Sharpe Ratio** (Bailey & López de Prado 2014):
  - Series: per-episode excess vs DAY1 on DEV. SR = mean / sd.
  - N = 76 trials. V[SR] = variance of the 76 variants' SRs.
  - Effective T = n_episodes × 30.44 / 365, because episodes overlap.
  - The selected variant's skew and kurtosis are used.

## PASS (per version; every item must hold)
1. The walk-forward DEV out-of-sample mean excess is > 0 vs DAY1 **and** > 0 vs CASH.
2. HOLDOUT: the selected variant's mean excess is > 0 vs DAY1 **and** vs CASH, with the 95 % CI lower bound > 0 for both.
3. DSR ≥ 0.95.

If any item fails, the answer is **"no rule passes"** and no bot rule is specified.

## Metrics reported
- Mean final value.
- Excess vs CASH and vs DAY1 (= opportunity cost).
- Share of episodes deployed and median days to the first fill.
- Mean number of deployments.
- Mean episode MaxDD of the reserve value.
- CAGR and MaxDD of the single long path DEV 2021-01-01 → 2025-10-03 and of HOLDOUT 2025-10-04 → 2026-10-03.
