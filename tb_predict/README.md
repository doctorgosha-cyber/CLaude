# TB-PREDICT

Paper-only research: can volumes + indicators predict crypto moves in calm markets?
See `REPORT.md` (answer), `PREREG.md` (frozen protocol), `tables/` (numbers).

    pip install pandas numpy pyarrow scikit-learn lightgbm scipy
    python run.py            # development phase, holdout masked (~3 min, 4 cores)
    python run.py --holdout  # one-shot holdout evaluation (lock file prevents re-runs)

Processed hourly data (`data/1h/*.parquet`, 22 symbols, 2019-01 .. 2026-10) is
committed; `fetch_data.py` re-downloads the raw mirrors if you need to rebuild.
No API keys, no exchange accounts, no orders.

Files: `config.py` (all research choices) · `data.py` (merge mirrors, resample)
· `features.py` (indicators, calm flags, targets) · `models.py` (purged
walk-forward) · `backtest.py` (costs, Sharpe, MaxDD, DSR) · `questions.py` (Q1–Q4).
