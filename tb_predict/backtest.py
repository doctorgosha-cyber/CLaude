"""Metrics: hit rate, AUC, P&L after costs, Sharpe, MaxDD, turnover, DSR."""
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import roc_auc_score

import config as C


def hit_auc(y, p):
    y, p = np.asarray(y), np.asarray(p)
    ok = ~(np.isnan(y) | np.isnan(p))
    y, p = y[ok], p[ok]
    if len(y) < 30 or len(np.unique(y)) < 2:
        return np.nan, np.nan, len(y)
    hit = float(((p > 0.5) == (y > 0.5)).mean())
    auc = float(roc_auc_score(y, p))
    return hit, auc, len(y)


def hit_ci(hit, n):
    """95 % binomial CI half-width for a hit rate."""
    if n == 0 or np.isnan(hit):
        return np.nan
    return 1.96 * np.sqrt(hit * (1 - hit) / n)


def strategy_pnl(df, p_col, bars_per_year, thr=C.PROB_THRESHOLD, long_short=False):
    """Per-symbol long/cash (or long/short) strategy from probabilities.
    df must contain ts, symbol, fwd_ret, p_col. Returns per-symbol returns
    table (ts x symbol) and position table."""
    pos = (df[p_col] > thr).astype(float)
    if long_short:
        pos = pos - (df[p_col] < 1 - thr).astype(float)
    d = df[["ts", "symbol", "fwd_ret"]].copy()
    d["pos"] = pos.values
    pos_t = d.pivot_table(index="ts", columns="symbol", values="pos")
    ret_t = d.pivot_table(index="ts", columns="symbol", values="fwd_ret")
    pos_t = pos_t.fillna(0.0)
    turn = (pos_t - pos_t.shift(1).fillna(0.0)).abs()
    strat = pos_t * ret_t.fillna(0.0) - turn * C.COST_SIDE
    return strat, pos_t, turn, ret_t


def perf(r, bars_per_year):
    r = pd.Series(r).dropna()
    if len(r) < 10:
        return dict(ann_ret=np.nan, sharpe=np.nan, maxdd=np.nan, n=len(r))
    eq = (1 + r).cumprod()
    years = len(r) / bars_per_year
    ann = eq.iloc[-1] ** (1 / years) - 1 if years > 0 and eq.iloc[-1] > 0 else -1.0
    sd = r.std()
    sharpe = r.mean() / sd * np.sqrt(bars_per_year) if sd > 0 else np.nan
    dd = (eq / eq.cummax() - 1).min()
    return dict(ann_ret=float(ann), sharpe=float(sharpe), maxdd=float(dd), n=len(r),
                total=float(eq.iloc[-1] - 1))


def deflated_sharpe(sr, n_trials, T, skew, kurt, sr_var_trials):
    """Deflated Sharpe Ratio (Bailey & López de Prado 2014). sr is the
    per-period Sharpe of the selected strategy, T the number of periods,
    sr_var_trials the variance of per-period Sharpe across the trials.
    Returns (DSR probability, SR0 benchmark)."""
    if n_trials < 2 or np.isnan(sr) or T < 10:
        return np.nan, np.nan
    e = np.euler_gamma
    z = stats.norm.ppf
    sr0 = np.sqrt(sr_var_trials) * ((1 - e) * z(1 - 1 / n_trials) + e * z(1 - 1 / (n_trials * np.e)))
    denom = np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr ** 2)
    if not np.isfinite(denom) or denom == 0:
        return np.nan, sr0
    stat = (sr - sr0) * np.sqrt(T - 1) / denom
    return float(stats.norm.cdf(stat)), float(sr0)


def psr(sr, T, skew, kurt, sr0=0.0):
    denom = np.sqrt(1 - skew * sr + (kurt - 1) / 4 * sr ** 2)
    return float(stats.norm.cdf((sr - sr0) * np.sqrt(T - 1) / denom)) if denom > 0 else np.nan


def md_table(df, floatfmt=".3f"):
    """Tiny markdown table writer (no tabulate dependency)."""
    cols = list(df.columns)
    lines = ["| " + " | ".join(str(c) for c in cols) + " |", "|" + "---|" * len(cols)]
    for _, row in df.iterrows():
        cells = []
        for c in cols:
            v = row[c]
            if isinstance(v, float):
                cells.append("" if np.isnan(v) else format(v, floatfmt))
            else:
                cells.append(str(v))
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)
