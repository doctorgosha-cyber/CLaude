"""Build the hourly dataset from the two public GitHub mirrors of Binance spot
klines (data.binance.vision itself is not reachable from the research box):

  * mdeacey/binance-crypto-coins-prices : csv/<SYMBOL>_H1.csv, 2017-08 .. 2024-03-14
  * Speirsy11/crypto-dataset            : 1h parquet, 2017-08 .. 2026-10-03, 10 symbols

Both are plain OHLCV (open, high, low, close, base volume). Neither carries
taker-buy volume or trade counts, so those features are unavailable.
Processed per-symbol parquet files are written to tb_predict/data/1h/ and
committed so that `python run.py` is reproducible without network access.
"""
import glob
import os
import sys

import numpy as np
import pandas as pd

from config import DATA_DIR, DATA_START, EXTENDED, RAW_DIR, UNIVERSE

H1_DIR = DATA_DIR / "1h"


def _load_mdeacey(sym):
    f = RAW_DIR / "mdeacey" / f"{sym}_H1.csv"
    df = pd.read_csv(f, parse_dates=["datetime"])
    df = df.rename(columns={"datetime": "ts"})
    df["ts"] = df["ts"].dt.tz_localize("UTC")
    return df.set_index("ts")[["open", "high", "low", "close", "volume"]].astype(float)


def _load_speirsy(sym):
    fs = sorted(glob.glob(str(RAW_DIR / "speirsy11" / f"{sym}-1h-*.parquet")))
    if not fs:
        return None
    df = pd.concat([pd.read_parquet(f) for f in fs])
    df = df.rename(columns={"timestamp": "ts"}).set_index("ts").sort_index()
    df.index = pd.DatetimeIndex(df.index).tz_convert("UTC")
    return df[["open", "high", "low", "close", "volume"]].astype(float)


def build_hourly(verbose=True):
    """Merge sources, sanity-check the overlap, write parquet files."""
    H1_DIR.mkdir(parents=True, exist_ok=True)
    report = []
    for sym in UNIVERSE:
        a = _load_mdeacey(sym)
        a = a[~a.index.duplicated(keep="last")].sort_index()
        b = _load_speirsy(sym) if sym in EXTENDED else None
        note = ""
        if b is not None:
            b = b[~b.index.duplicated(keep="last")].sort_index()
            common = a.index.intersection(b.index)
            if len(common) > 1000:
                rel = (a.loc[common, "close"] / b.loc[common, "close"] - 1).abs()
                note = f"overlap={len(common)} bars, median|dClose|={rel.median():.2e}, max={rel.max():.2e}"
            cutoff = a.index.max()
            df = pd.concat([a, b[b.index > cutoff]])
        else:
            df = a
        df = df[df.index >= pd.Timestamp(DATA_START, tz="UTC")]
        # regular hourly grid; small gaps (exchange downtime) are forward-filled
        # on price with zero volume, long gaps are left as NaN.
        full = pd.date_range(df.index.min(), df.index.max(), freq="1h", tz="UTC")
        df = df.reindex(full)
        gap = df["close"].isna()
        n_gap = int(gap.sum())
        df["close"] = df["close"].ffill(limit=6)
        for c in ["open", "high", "low"]:
            df[c] = df[c].fillna(df["close"])
        df["volume"] = df["volume"].fillna(0.0)
        df = df.dropna(subset=["close"])
        df.index.name = "ts"
        df.to_parquet(H1_DIR / f"{sym}.parquet", compression="zstd")
        line = f"{sym:9s} {df.index.min().date()} .. {df.index.max().date()} rows={len(df):6d} gaps_filled={n_gap:4d} {note}"
        report.append(line)
        if verbose:
            print(line)
    (DATA_DIR / "BUILD_LOG.txt").write_text("\n".join(report) + "\n")
    return report


def load_hourly(sym):
    return pd.read_parquet(H1_DIR / f"{sym}.parquet")


def resample(df, rule):
    """Aggregate 1h OHLCV to a coarser bar. Bars are labelled by their OPEN time
    and closed on the left (Binance convention). Weekly = Monday 00:00 UTC."""
    if rule == "1h":
        return df.copy()
    if rule == "W-MON":
        # pandas W-MON labels by the period end; shift so label = Monday open.
        o = df.resample("W-MON", label="left", closed="left").agg(
            open=("open", "first"), high=("high", "max"), low=("low", "min"),
            close=("close", "last"), volume=("volume", "sum"), n=("close", "size"))
    else:
        o = df.resample(rule, label="left", closed="left").agg(
            open=("open", "first"), high=("high", "max"), low=("low", "min"),
            close=("close", "last"), volume=("volume", "sum"), n=("close", "size"))
    return o.dropna(subset=["close"])


if __name__ == "__main__":
    build_hourly()
