"""Walk-forward engine: rolling 3-year training window, quarterly test blocks,
purge of one horizon + 7-day embargo between the last training label and the
first test timestamp. Pooled across symbols. No hyper-parameters are tuned on
test blocks (fixed values in config.py)."""
import warnings

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

import config as C

warnings.filterwarnings("ignore")

try:
    import lightgbm as lgb
except ImportError:  # pragma: no cover
    lgb = None

EXPECTED_N = {"4h": 4, "1d": 24, "1w": 168}


def clean_panel(panel, horizon):
    """Drop partial bars and rows with missing target/features."""
    p = panel[panel["bar_n"] >= EXPECTED_N[horizon]].copy()
    return p


def test_blocks(start, end, months=C.TEST_BLOCK_MONTHS):
    s0 = pd.Timestamp(start, tz="UTC").to_period("M").to_timestamp().tz_localize("UTC")
    starts = pd.date_range(s0, end, freq=f"{months}MS", tz="UTC")
    out = []
    for s in starts:
        e = min(s + pd.DateOffset(months=months), pd.Timestamp(end, tz="UTC"))
        if e > s:
            out.append((s, e))
    return out


def _fit_predict(Xtr, ytr, Xte, model, seed=C.SEED):
    if model == "logit":
        m = make_pipeline(StandardScaler(), LogisticRegression(C=C.LOGIT_C, max_iter=2000))
        m.fit(Xtr, ytr)
        return m.predict_proba(Xte)[:, 1]
    if model == "lgbm":
        m = lgb.LGBMClassifier(random_state=seed, **C.LGBM_PARAMS)
        m.fit(Xtr, ytr)
        return m.predict_proba(Xte)[:, 1]
    if model == "ridge":
        m = make_pipeline(StandardScaler(), Ridge(alpha=10.0))
        m.fit(Xtr, ytr)
        return m.predict(Xte)
    if model == "lgbm_reg":
        m = lgb.LGBMRegressor(random_state=seed, **C.LGBM_PARAMS)
        m.fit(Xtr, ytr)
        return m.predict(Xte)
    raise ValueError(model)


def walk_forward(panel, features, horizon, target="y", models=("logit", "lgbm"),
                 start=C.DEV_START, end=C.HOLDOUT_START, shuffle_control=True,
                 train_mask=None, embargo_days=7, verbose=False):
    """Returns the panel rows in [start, end) with one prediction column per
    model (p_<model>) and, optionally, a shuffled-label control (p_shuffle).
    `train_mask` optionally restricts training rows (e.g. calm-only)."""
    horizon_td = {"4h": pd.Timedelta(hours=4), "1d": pd.Timedelta(days=1), "1w": pd.Timedelta(days=7)}[horizon]
    p = panel.dropna(subset=features + [target]).copy()
    p = p.replace([np.inf, -np.inf], np.nan).dropna(subset=features)
    outs = []
    rng = np.random.RandomState(C.SEED)
    for bs, be in test_blocks(start, end):
        te = p[(p["ts"] >= max(bs, pd.Timestamp(start, tz="UTC"))) & (p["ts"] < be)]
        if te.empty:
            continue
        # purge + embargo: the training label of a row at t is known at t+horizon;
        # require t + horizon + embargo <= bs
        tr_end = bs - horizon_td - pd.Timedelta(days=embargo_days)
        tr_start = bs - pd.DateOffset(years=C.TRAIN_YEARS)
        tr = p[(p["ts"] >= tr_start) & (p["ts"] <= tr_end)]
        if train_mask is not None:
            tr = tr[train_mask.reindex(tr.index).fillna(False).values]
        if len(tr) < C.MIN_TRAIN_ROWS:
            continue
        Xtr, ytr, Xte = tr[features].values, tr[target].values, te[features].values
        res = te.copy()
        for m in models:
            res[f"p_{m}"] = _fit_predict(Xtr, ytr, Xte, m)
        if shuffle_control:
            ysh = rng.permutation(ytr)
            res["p_shuffle"] = _fit_predict(Xtr, ysh, Xte, models[-1])
        res["block"] = bs
        outs.append(res)
        if verbose:
            print(f"  block {bs.date()}..{be.date()} train={len(tr)} test={len(te)}")
    return pd.concat(outs) if outs else pd.DataFrame()
