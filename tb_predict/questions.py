"""Answers to the four brief questions. Every function works for phase='dev'
(holdout rows masked) and phase='holdout' (holdout rows only)."""
import numpy as np
import pandas as pd
from scipy import stats

import config as C
from backtest import deflated_sharpe, hit_auc, hit_ci, md_table, perf, strategy_pnl
from data import load_hourly, resample
from features import build_panel, feature_columns
from models import clean_panel, walk_forward

BPY = {"4h": 6 * 365, "1d": 365, "1w": 52}
TRIALS = []   # (name, per-period sharpe, T, skew, kurt) for DSR


# ------------------------------------------------------------------ masks
def holdout_b_rows(df):
    return df["symbol"].isin(C.HOLDOUT_B_SYMBOLS) & (df["ts"] >= pd.Timestamp(C.HOLDOUT_B_START, tz="UTC")) \
        & (df["ts"] < pd.Timestamp(C.HOLDOUT_B_END, tz="UTC"))


def holdout_a_rows(df):
    return df["symbol"].isin(C.EXTENDED) & (df["ts"] >= pd.Timestamp(C.HOLDOUT_START, tz="UTC")) \
        & (df["ts"] < pd.Timestamp(C.HOLDOUT_END, tz="UTC"))


def phase_rows(df, phase):
    if phase == "dev":
        return (~holdout_b_rows(df)) & (df["ts"] < pd.Timestamp(C.HOLDOUT_START, tz="UTC"))
    return holdout_a_rows(df) | holdout_b_rows(df)


def wf(panel, feats, horizon, phase, **kw):
    """Walk-forward restricted to the phase. In dev, holdout-B rows are also
    removed from the training set."""
    if phase == "dev":
        mask = ~holdout_b_rows(panel)
        res = walk_forward(panel, feats, horizon, start=C.DEV_START, end=C.HOLDOUT_START,
                           train_mask=mask & kw.pop("train_mask", pd.Series(True, index=panel.index)), **kw)
    else:
        res = walk_forward(panel, feats, horizon, start=C.HOLDOUT_B_START, end=C.HOLDOUT_END, **kw)
    if res.empty:
        return res
    return res[phase_rows(res, phase).values]


def _record_trial(name, r, bpy):
    r = pd.Series(r).dropna()
    if len(r) > 20 and r.std() > 0:
        TRIALS.append(dict(name=name, sr=r.mean() / r.std(), T=len(r), skew=float(stats.skew(r)),
                           kurt=float(stats.kurtosis(r, fisher=False)), bpy=bpy))


def _strategy_row(name, res, p_col, horizon, thr, calm_only=False):
    bpy = BPY[horizon]
    d = res.copy()
    if calm_only:
        d[p_col] = d[p_col].where(d["calm"].astype(bool), 0.0)
    strat, pos, turn, ret = strategy_pnl(d, p_col, bpy, thr=thr)
    r = strat.mean(axis=1)
    bh = ret.mean(axis=1)
    sp, bp = perf(r, bpy), perf(bh, bpy)
    years = len(strat) / bpy
    turnover = turn.sum().sum() / pos.shape[1] / years if years > 0 else np.nan
    _record_trial(name, r, bpy)
    exposure = float(pos.mean().mean())
    return dict(strategy=name, ann_ret=sp["ann_ret"], sharpe=sp["sharpe"], maxdd=sp["maxdd"],
                turnover_per_sym_yr=turnover, exposure=exposure,
                bh_ann_ret=bp["ann_ret"], bh_sharpe=bp["sharpe"], bh_maxdd=bp["maxdd"], periods=len(r))


# ------------------------------------------------------------------ Q1
def q1_direction(panels, feats, phase, out):
    rows, strat_rows, preds = [], [], {}
    for h in ["4h", "1d", "1w"]:
        res = wf(panels[h], feats, h, phase)
        preds[h] = res
        for sub, m in [("all", None), ("BTC", "BTCUSDT"), ("ETH", "ETHUSDT"), ("alts", "alt")]:
            if m == "alt":
                d = res[res["is_alt"] == 1]
            elif m:
                d = res[res["symbol"] == m]
            else:
                d = res
            for model in ["logit", "lgbm", "shuffle"]:
                hit, auc, n = hit_auc(d["y"], d[f"p_{model}"])
                rows.append(dict(horizon=h, subset=sub, model=model, n=n, hit=hit, hit_ci95=hit_ci(hit, n),
                                 base_rate_up=float(d["y"].mean()) if n else np.nan, auc=auc))
        for model in ["logit", "lgbm"]:
            for thr in [0.55, 0.50]:
                strat_rows.append(dict(horizon=h, **_strategy_row(f"Q1 {h} {model} thr{thr}", res, f"p_{model}", h, thr)))
        # per-symbol detail at this horizon
        det = []
        for sym, d in res.groupby("symbol"):
            hit, auc, n = hit_auc(d["y"], d["p_lgbm"])
            det.append(dict(symbol=sym, n=n, hit_lgbm=hit, auc_lgbm=auc, base_rate_up=float(d["y"].mean())))
        (out / f"{phase}_q1_persymbol_{h}.md").write_text(md_table(pd.DataFrame(det)))
    t1 = pd.DataFrame(rows)
    t2 = pd.DataFrame(strat_rows)
    btc = {}
    for h in ["4h", "1d", "1w"]:
        d = preds[h][preds[h]["symbol"] == "BTCUSDT"].drop_duplicates("ts").sort_values("ts")
        btc[h] = perf(d["fwd_ret"], BPY[h])
    txt = (f"# Q1 direction — {phase}\n\nHit rate / AUC out-of-sample (walk-forward). "
           "'shuffle' = LightGBM trained on permuted labels (control).\n\n" + md_table(t1) +
           "\n\n## Trading P&L after costs (long/cash, equal weight over symbols) vs equal-weight buy-and-hold\n\n"
           + md_table(t2) + "\n\n## BTC buy-and-hold over the same periods\n\n"
           + md_table(pd.DataFrame([dict(horizon=h, **v) for h, v in btc.items()])))
    (out / f"{phase}_q1_direction.md").write_text(txt)
    return preds, t1, t2


# ------------------------------------------------------------------ Q2
def q2_calm(panels, feats, phase, preds, out):
    rows, strat_rows, share = [], [], []
    for h in ["4h", "1d", "1w"]:
        res = preds[h]
        calm = res["calm"].astype(bool)
        share.append(dict(horizon=h, rows=len(res), calm_share=float(calm.mean())))
        for model in ["logit", "lgbm", "shuffle"]:
            for name, msk in [("calm", calm), ("not_calm", ~calm)]:
                d = res[msk]
                hit, auc, n = hit_auc(d["y"], d[f"p_{model}"])
                rows.append(dict(horizon=h, regime=name, model=model, n=n, hit=hit, hit_ci95=hit_ci(hit, n),
                                 base_rate_up=float(d["y"].mean()) if n else np.nan, auc=auc,
                                 mean_fwd_ret=float(d["fwd_ret"].mean()) if n else np.nan,
                                 std_fwd_ret=float(d["fwd_ret"].std()) if n else np.nan))
        for model in ["logit", "lgbm"]:
            strat_rows.append(dict(horizon=h, **_strategy_row(f"Q2 {h} {model} calm-only trade", res, f"p_{model}", h,
                                                              C.PROB_THRESHOLD, calm_only=True)))
        # (c) calm-only training set
        pm = panels[h]
        res_c = wf(pm, feats, h, phase, models=("lgbm",), shuffle_control=False,
                   train_mask=pm["calm"].astype(bool))
        if not res_c.empty:
            for name, msk in [("calm", res_c["calm"].astype(bool)), ("not_calm", ~res_c["calm"].astype(bool))]:
                d = res_c[msk]
                hit, auc, n = hit_auc(d["y"], d["p_lgbm"])
                rows.append(dict(horizon=h, regime=name, model="lgbm_calm_trained", n=n, hit=hit, hit_ci95=hit_ci(hit, n),
                                 base_rate_up=float(d["y"].mean()) if n else np.nan, auc=auc,
                                 mean_fwd_ret=float(d["fwd_ret"].mean()) if n else np.nan,
                                 std_fwd_ret=float(d["fwd_ret"].std()) if n else np.nan))
    txt = (f"# Q2 calm regime — {phase}\n\ncalm = RV72h < 90d median AND no 3σ 1h-shock in 72h AND 72h volume z < 2.\n\n"
           + md_table(pd.DataFrame(share)) + "\n\n## Predictability inside vs outside calm\n\n" + md_table(pd.DataFrame(rows))
           + "\n\n## Trade only inside calm windows (long/cash, thr 0.55)\n\n" + md_table(pd.DataFrame(strat_rows)))
    (out / f"{phase}_q2_calm.md").write_text(txt)
    return pd.DataFrame(rows), pd.DataFrame(strat_rows)


# ------------------------------------------------------------------ Q3
def _btc_daily_regime():
    d = resample(load_hourly("BTCUSDT"), "1D")
    c = d["close"]
    reg = pd.DataFrame({"above_ema200": c > c.ewm(span=200, adjust=False).mean(),
                        "above_ema100": c > c.ewm(span=100, adjust=False).mean()})
    reg.index = reg.index + pd.Timedelta(days=1)   # known at the close of the daily bar
    return reg


def m5b100_returns(wk, scale=None):
    """Weekly returns of the reconstructed M5-B100 arm. wk: weekly panel rows
    (ts, symbol, fwd_ret, mom4). scale: Series indexed by ts in [0,1]."""
    reg = _btc_daily_regime()
    alts = wk[wk["symbol"].isin(C.ALTS)]
    weights = {}
    for ts, g in alts.groupby("ts"):
        r = reg[reg.index <= ts]
        if r.empty:
            continue
        r = r.iloc[-1]
        w = {}
        g = g.dropna(subset=["mom4"])
        if r["above_ema200"] and len(g) >= 5:
            for s in g.nlargest(5, "mom4")["symbol"]:
                w[s] = 0.7 / 5
        if r["above_ema100"]:
            w["BTCUSDT"] = 0.3
        weights[ts] = w
    W = pd.DataFrame(weights).T.fillna(0.0).sort_index()
    if scale is not None:
        W = W.mul(scale.reindex(W.index).fillna(1.0).clip(0, 1), axis=0)
    R = wk.pivot_table(index="ts", columns="symbol", values="fwd_ret").reindex(W.index)[W.columns].fillna(0.0)
    turn = (W - W.shift(1).fillna(0.0)).abs().sum(axis=1)
    port = (W * R).sum(axis=1) - turn * C.COST_SIDE
    return port, W, turn


def q3_vol(panels, feats, phase, preds, out):
    pm = panels["1w"].copy()
    pm["log_rv_now"] = np.log(pm["rv_now"])
    pm["log_rv_next"] = np.log(pm["rv_next"])
    pm["rv_mean4"] = pm.groupby("symbol")["rv_now"].transform(lambda s: s.rolling(4, min_periods=1).mean())
    pm["dd10"] = (pm["fwd_mdd"] < -0.10).astype(float)
    pm.loc[pm["fwd_mdd"].isna(), "dd10"] = np.nan
    pm["mom4"] = pm.groupby("symbol")["close"].transform(lambda s: s / s.shift(4) - 1)
    vf = feats + ["log_rv_now"]
    # --- next-week realised vol
    rv = wf(pm.dropna(subset=["log_rv_next", "log_rv_now"]), vf, "1w", phase, target="log_rv_next",
            models=("ridge", "lgbm_reg"), shuffle_control=False)
    rows = []
    y = rv["log_rv_next"]
    var = ((y - y.mean()) ** 2).mean()
    mse_p = ((y - rv["log_rv_now"]) ** 2).mean()
    for name, pred in [("persistence (last week RV)", rv["log_rv_now"]), ("4-week mean RV", np.log(rv["rv_mean4"])),
                       ("ridge", rv["p_ridge"]), ("lgbm", rv["p_lgbm_reg"])]:
        mse = ((y - pred) ** 2).mean()
        rows.append(dict(model=name, n=len(y), r2_oos=1 - mse / var, r2_vs_persistence=1 - mse / mse_p,
                         mae_log=(y - pred).abs().mean(), spearman=stats.spearmanr(y, pred)[0]))
    t_rv = pd.DataFrame(rows)
    # --- drawdown risk
    dd = wf(pm.dropna(subset=["dd10", "log_rv_now"]), vf, "1w", phase, target="dd10", models=("logit", "lgbm"),
            shuffle_control=True)
    rows = []
    for name, p in [("rv_now (baseline ranking)", dd["log_rv_now"]), ("logit", dd["p_logit"]), ("lgbm", dd["p_lgbm"]),
                    ("shuffle", dd["p_shuffle"])]:
        hit, auc, n = hit_auc(dd["dd10"], p if name != "rv_now (baseline ranking)" else stats.rankdata(p) / len(p))
        rows.append(dict(model=name, n=n, auc=auc, base_rate_dd10=float(dd["dd10"].mean())))
    t_dd = pd.DataFrame(rows)
    # --- M5-B100 with target-vol sizing
    wk = pm[phase_rows(pm, phase).values].copy()
    wk = wk[wk["ts"] >= pd.Timestamp(C.DEV_START, tz="UTC")]
    if phase == "holdout":
        wk = wk[holdout_a_rows(wk).values]  # the arm needs BTC + alts in the same weeks: only holdout A
    pred_rv = rv.set_index(["ts", "symbol"])["p_lgbm_reg"]
    base, W, turn = m5b100_returns(wk)
    # realised-vol scale: basket average of last-week RV; model scale: basket average of predicted RV
    def basket_scale(src):
        out = {}
        for ts, w in W.iterrows():
            held = w[w > 0].index
            if len(held) == 0:
                out[ts] = 1.0
                continue
            vals = []
            for s in held:
                v = src.get((ts, s), np.nan)
                if not np.isnan(v):
                    vals.append(v)
            out[ts] = min(1.0, C.VOL_TARGET_ANNUAL / np.mean(vals)) if vals else 1.0
        return pd.Series(out)
    rv_now_map = wk.set_index(["ts", "symbol"])["rv_now"]
    s_real = basket_scale(rv_now_map)
    s_model = basket_scale(np.exp(pred_rv))
    real, _, turn_r = m5b100_returns(wk, scale=s_real)
    model, _, turn_m = m5b100_returns(wk, scale=s_model)
    rows = []
    for name, r, t in [("M5-B100 (no sizing)", base, turn), ("M5-B100 target-vol, realised vol", real, turn_r),
                       ("M5-B100 target-vol, model vol", model, turn_m)]:
        pf = perf(r, 52)
        if "target-vol" in name:
            _record_trial("Q3 " + name, r, 52)
        rows.append(dict(strategy=name, weeks=len(r), ann_ret=pf["ann_ret"], sharpe=pf["sharpe"], maxdd=pf["maxdd"],
                         turnover_per_yr=float(t.mean() * 52), avg_exposure=float(W.sum(axis=1).mean())))
    btc = wk[wk["symbol"] == "BTCUSDT"].drop_duplicates("ts").sort_values("ts")
    pf = perf(btc["fwd_ret"], 52)
    rows.append(dict(strategy="BTC buy-and-hold", weeks=len(btc), ann_ret=pf["ann_ret"], sharpe=pf["sharpe"],
                     maxdd=pf["maxdd"], turnover_per_yr=0.0, avg_exposure=1.0))
    t_arm = pd.DataFrame(rows)
    txt = (f"# Q3 volatility / drawdown / target-vol — {phase}\n\n## Next-week realised vol (log, annualised), weekly, pooled\n\n"
           + md_table(t_rv) + "\n\n## Next-week drawdown > 10 % from entry (classification)\n\n" + md_table(t_dd)
           + "\n\n## Reconstructed M5-B100 arm with target-vol sizing (after costs, weekly)\n\n" + md_table(t_arm)
           + f"\n\nTarget vol {C.VOL_TARGET_ANNUAL:.0%} annualised, scale = min(1, target / basket vol).")
    (out / f"{phase}_q3_vol.md").write_text(txt)
    return t_rv, t_dd, t_arm, pm


# ------------------------------------------------------------------ Q4
def q4_ranking(pm, feats, phase, preds, out):
    alts = pm[pm["symbol"].isin(C.ALTS)].copy()
    er = wf(alts, feats, "1w", phase, target="fwd_lr", models=("lgbm_reg",), shuffle_control=False)
    p1w = preds["1w"][["ts", "symbol", "p_logit"]]
    d = er.merge(p1w, on=["ts", "symbol"], how="left")
    d = d.dropna(subset=["mom4", "fwd_lr"])
    d["rank_mom"] = d.groupby("ts")["mom4"].rank()
    d["rank_lgbm"] = d.groupby("ts")["p_lgbm_reg"].rank()
    d["blend"] = d["rank_mom"] + d["rank_lgbm"]
    scores = {"4-week momentum": "mom4", "lgbm expected return": "p_lgbm_reg", "logit P(up)": "p_logit",
              "blend mom+lgbm": "blend"}
    rows, port_rows = [], []
    for name, col in scores.items():
        ics, rets = [], {}
        for ts, g in d.groupby("ts"):
            g = g.dropna(subset=[col])
            if len(g) < 8:
                continue
            ics.append(stats.spearmanr(g[col], g["fwd_lr"])[0])
            top = g.nlargest(5, col)
            rets[ts] = top.set_index("symbol")["fwd_ret"]
        ics = pd.Series(ics)
        rows.append(dict(score=name, weeks=len(ics), mean_rank_ic=ics.mean(), ic_tstat=ics.mean() / ics.std() * np.sqrt(len(ics)),
                         pct_weeks_ic_pos=float((ics > 0).mean())))
        # top-5 EW long-only after costs
        W = pd.DataFrame({ts: pd.Series(0.2, index=r.index) for ts, r in rets.items()}).T.fillna(0.0).sort_index()
        R = pd.DataFrame({ts: r for ts, r in rets.items()}).T.reindex(W.index).fillna(0.0)
        turn = (W - W.shift(1).fillna(0.0)).abs().sum(axis=1)
        pr = (W * R).sum(axis=1) - turn * C.COST_SIDE
        pf = perf(pr, 52)
        if name != "4-week momentum":
            _record_trial("Q4 top5 " + name, pr, 52)
        port_rows.append(dict(score=name, weeks=len(pr), ann_ret=pf["ann_ret"], sharpe=pf["sharpe"], maxdd=pf["maxdd"],
                              turnover_per_yr=float(turn.mean() * 52)))
    ew = d.groupby("ts")["fwd_ret"].mean()
    pf = perf(ew, 52)
    port_rows.append(dict(score="equal-weight all alts (B&H, no costs)", weeks=len(ew), ann_ret=pf["ann_ret"],
                          sharpe=pf["sharpe"], maxdd=pf["maxdd"], turnover_per_yr=0.0))
    txt = (f"# Q4 cross-sectional ranking of the 20 alts, weekly — {phase}\n\n## Rank information coefficient (Spearman, score vs next-week return)\n\n"
           + md_table(pd.DataFrame(rows)) + "\n\n## Top-5 equal-weight long-only, weekly rebalance, after costs\n\n"
           + md_table(pd.DataFrame(port_rows)))
    (out / f"{phase}_q4_ranking.md").write_text(txt)
    return pd.DataFrame(rows), pd.DataFrame(port_rows)


# ------------------------------------------------------------------ DSR
def trials_table(phase, out):
    t = pd.DataFrame(TRIALS)
    if t.empty:
        return t
    n = len(t)
    var_sr = t["sr"].var()
    rows = []
    for _, r in t.iterrows():
        dsr, sr0 = deflated_sharpe(r["sr"], n, r["T"], r["skew"], r["kurt"], var_sr)
        rows.append(dict(strategy=r["name"], sharpe_ann=r["sr"] * np.sqrt(r["bpy"]), periods=r["T"], dsr=dsr,
                         sr0_ann=sr0 * np.sqrt(r["bpy"]) if sr0 == sr0 else np.nan))
    tt = pd.DataFrame(rows)
    txt = (f"# Deflated Sharpe Ratio — {phase}\n\nN = {n} trading-strategy trials (prereg: 24). "
           f"SR0 = expected max Sharpe of N unskilled trials given the empirical trial variance. "
           f"DSR = P(true Sharpe > SR0) after skew/kurtosis correction.\n\n" + md_table(tt))
    (out / f"{phase}_dsr.md").write_text(txt)
    return tt


def run_phase(phase, out):
    TRIALS.clear()
    panels, feats = {}, None
    for h in ["4h", "1d", "1w"]:
        panels[h] = clean_panel(build_panel(h), h)
        feats = feats or feature_columns(panels[h])
        print(f"[{phase}] panel {h}: {panels[h].shape}")
    preds, q1a, q1b = q1_direction(panels, feats, phase, out)
    print(f"[{phase}] Q1 done")
    q2_calm(panels, feats, phase, preds, out)
    print(f"[{phase}] Q2 done")
    _, _, _, pm = q3_vol(panels, feats, phase, preds, out)
    print(f"[{phase}] Q3 done")
    q4_ranking(pm, feats, phase, preds, out)
    print(f"[{phase}] Q4 done")
    trials_table(phase, out)
    for h, r in preds.items():
        r.to_parquet(out / f"{phase}_predictions_{h}.parquet", compression="zstd")
