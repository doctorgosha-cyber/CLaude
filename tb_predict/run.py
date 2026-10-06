"""TB-PREDICT entry point.

    python run.py              # build data if needed, run the development phase (holdout masked)
    python run.py --holdout    # evaluate the preregistered variants on the holdout ONCE

Raw inputs (data_raw/) come from two public GitHub mirrors of Binance klines;
processed hourly parquet files live in tb_predict/data/1h and are committed.
"""
import argparse
import datetime as dt
import sys
import time

import config as C

LOCK = C.ROOT / "HOLDOUT_EVALUATED.txt"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--holdout", action="store_true", help="run the one-shot holdout evaluation")
    ap.add_argument("--rebuild-data", action="store_true", help="rebuild data/1h from data_raw")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    C.TABLES_DIR.mkdir(exist_ok=True)
    if a.rebuild_data or not (C.DATA_DIR / "1h").exists():
        from data import build_hourly
        build_hourly()
    from questions import run_phase
    t = time.time()
    if a.holdout:
        if LOCK.exists() and not a.force:
            print(f"Holdout already evaluated ({LOCK.read_text().strip()}). Refusing to re-run without --force.")
            sys.exit(1)
        run_phase("holdout", C.TABLES_DIR)
        LOCK.write_text(f"holdout evaluated once at {dt.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n")
    else:
        run_phase("dev", C.TABLES_DIR)
    print(f"done in {time.time()-t:.0f}s -> {C.TABLES_DIR}")


if __name__ == "__main__":
    main()
