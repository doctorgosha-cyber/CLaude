"""Price/volume features at the decision frequency, calm-regime flags from
1h data, and forward targets. No funding, no taker-buy ratio (not in the
public mirrors), no calendar features."""
import numpy as np
import pandas as pd

import config as C
from data import load_hourly, resample

RET_LOOKBACKS = [1, 2, 3, 5, 10, 20, 60]


def _rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = up / dn.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def bar_features(bars, prefix=""):
    """Features from OHLCV bars at one frequency. All use data up to and
    including the current (closed) bar."""
    c, h, l, v = bars["close"], bars["high"], bars["low"], bars["volume"]
    lr = np.log(c).diff()
    f = pd.DataFrame(index=bars.index)
    for k in RET_LOOKBACKS:
        f[f"ret_{k}"] = np.log(c / c.shift(k))
    f["rsi14"] = _rsi(c, 14)
    ema12, ema26 = c.ewm(span=12, adjust=False).mean(), c.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    f["macd"] = macd / c
    f["macd_hist"] = (macd - macd.ewm(span=9, adjust=False).mean()) / c
    m20, s20 = c.rolling(20).mean(), c.rolling(20).std()
    f["bb_pctb"] = (c - (m20 - 2 * s20)) / (4 * s20)
    f["bb_width"] = 4 * s20 / m20
    tr = pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)
    f["atr14"] = tr.ewm(alpha=1 / 14, adjust=False).mean() / c
    f["rv5"] = lr.rolling(5).std()
    f["rv20"] = lr.rolling(20).std()
    f["rv60"] = lr.rolling(60).std()
    f["rv_ratio"] = f["rv5"] / f["rv20"]
    f["ema50_dist"] = c / c.ewm(span=50, adjust=False).mean() - 1
    f["ema200_dist"] = c / c.ewm(span=200, adjust=False).mean() - 1
    f["range"] = (h - l) / c
    lv = np.log(v.replace(0, np.nan)).ffill()
    f["vol_z20"] = (lv - lv.rolling(20).mean()) / lv.rolling(20).std()
    f["vol_z60"] = (lv - lv.rolling(60).mean()) / lv.rolling(60).std()
    f["vol_chg5"] = lv - lv.shift(5)
    obv = (np.sign(lr).fillna(0) * v).cumsum()
    f["obv_slope10"] = (obv - obv.shift(10)) / v.rolling(10).sum().replace(0, np.nan)
    f["obv_slope30"] = (obv - obv.shift(30)) / v.rolling(30).sum().replace(0, np.nan)
    f["ret_vol_corr20"] = lr.rolling(20).corr(lv.diff())
    f["skew20"] = lr.rolling(20).skew()
    f["max20_dist"] = c / c.rolling(20).max() - 1
    f["min20_dist"] = c / c.rolling(20).min() - 1
    if prefix:
        f.columns = [prefix + x for x in f.columns]
    return f


def calm_flags(h1):
    """Objective 'calm' definition on 1h data (brief, Q2):
       RV(72h) below its rolling 90-day median
       AND no |1h return| > 3 sigma(30d) in the last 72h
       AND 72h volume z-score (vs 30d) < 2."""
    lr = np.log(h1["close"]).diff()
    rv72 = lr.rolling(C.CALM_RV_WINDOW_H).std()
    rv_med = rv72.rolling(24 * C.CALM_RV_MEDIAN_DAYS, min_periods=24 * 30).median()
    sigma = lr.rolling(24 * C.CALM_SIGMA_DAYS).std().shift(1)
    shock = (lr.abs() > C.CALM_SHOCK_SIGMAS * sigma).astype(float)
    shock72 = shock.rolling(C.CALM_RV_WINDOW_H).sum()
    v = h1["volume"]
    v72 = v.rolling(72).mean()
    vm = v.rolling(24 * 30).mean()
    vs = v.rolling(24 * 30).std()
    vz = (v72 - vm) / vs
    out = pd.DataFrame({"calm_rv": rv72 < rv_med, "calm_noshock": shock72 == 0,
                        "calm_vol": vz < C.CALM_VOL_Z_MAX, "rv72": rv72, "vz72": vz})
    out["calm"] = out["calm_rv"] & out["calm_noshock"] & out["calm_vol"]
    return out


def build_panel(horizon):
    """Stacked (symbol, ts) feature panel for one horizon with targets."""
    rule, bpy, purge, embargo = C.HORIZONS[horizon]
    btc_h1 = load_hourly("BTCUSDT")
    btc_bars = resample(btc_h1, rule)
    btc_f = bar_features(btc_bars, prefix="btc_")[
        ["btc_ret_1", "btc_ret_5", "btc_ret_20", "btc_rv20", "btc_rsi14", "btc_ema200_dist", "btc_vol_z20"]]
    frames = []
    for sym in C.UNIVERSE:
        h1 = load_hourly(sym)
        bars = resample(h1, rule)
        f = bar_features(bars)
        # calm flag as of the bar close (last 1h bar inside the decision bar)
        cf = calm_flags(h1)
        close_times = bars.index + pd.tseries.frequencies.to_offset(rule) if rule != "W-MON" else bars.index + pd.Timedelta(days=7)
        cf_at = cf.reindex(close_times - pd.Timedelta(hours=1), method="ffill")
        cf_at.index = bars.index
        f = f.join(cf_at[["calm", "calm_rv", "calm_noshock", "calm_vol"]])
        f = f.join(btc_f, how="left")
        c = bars["close"]
        f["fwd_ret"] = c.shift(-1) / c - 1            # simple next-bar return (for P&L)
        f["fwd_lr"] = np.log(c.shift(-1) / c)
        f["y"] = (f["fwd_lr"] > 0).astype(float)
        f.loc[f["fwd_lr"].isna(), "y"] = np.nan
        # Q3 targets at the weekly frequency: next-week realized vol and drawdown
        if horizon == "1w":
            lr1h = np.log(h1["close"]).diff()
            rv_week = lr1h.rolling(168).std() * np.sqrt(24 * 365)      # annualised, trailing 7d
            rv_next = rv_week.shift(-168)
            f["rv_now"] = rv_week.reindex(bars.index + pd.Timedelta(days=7) - pd.Timedelta(hours=1), method="ffill").values
            f["rv_next"] = rv_next.reindex(bars.index + pd.Timedelta(days=7) - pd.Timedelta(hours=1), method="ffill").values
            # next-week max drawdown from the entry close
            lows = h1["low"]
            nxt_min = pd.Series([np.nan] * len(bars), index=bars.index)
            idx = bars.index
            for i in range(len(idx) - 1):
                seg = lows[(lows.index >= idx[i + 1]) & (lows.index < idx[i + 1] + pd.Timedelta(days=7))]
                nxt_min.iloc[i] = seg.min() / c.iloc[i] - 1 if len(seg) else np.nan
            f["fwd_mdd"] = nxt_min
        # fully-formed bars only (partial last bar / partial first bar)
        f["bar_n"] = bars["n"]
        f["close"] = bars["close"]
        f["symbol"] = sym
        f["is_alt"] = float(sym in C.ALTS)
        frames.append(f)
    panel = pd.concat(frames).reset_index().rename(columns={"index": "ts"})
    panel = panel[panel["ts"] >= pd.Timestamp(C.DATA_START, tz="UTC")]
    return panel


FEATURE_COLS = None


def feature_columns(panel):
    skip = {"ts", "symbol", "y", "fwd_ret", "fwd_lr", "fwd_mdd", "rv_next", "rv_now", "bar_n", "close",
            "calm", "calm_rv", "calm_noshock", "calm_vol"}
    return [c for c in panel.columns if c not in skip]


if __name__ == "__main__":
    import time
    for h in ["1w"]:
        t = time.time()
        p = build_panel(h)
        print(h, p.shape, f"{time.time()-t:.1f}s")
        print(p.tail(3).T)
