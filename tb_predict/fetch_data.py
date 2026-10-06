"""Download the raw inputs into ../data_raw from the two public GitHub mirrors.
Only needed to rebuild tb_predict/data/1h (which is committed).

    python fetch_data.py && python run.py --rebuild-data
"""
import subprocess
import sys
from pathlib import Path

import config as C

RAW = C.RAW_DIR
MD = "https://raw.githubusercontent.com/mdeacey/binance-crypto-coins-prices/main/csv/{sym}_H1.csv"
SP_TREE = "https://github.com/Speirsy11/crypto-dataset"  # LFS objects served via media.githubusercontent.com
SP = "https://media.githubusercontent.com/media/Speirsy11/crypto-dataset/main/data/interval_id=1h/symbol_id={sym}/year={y}/month={m:02d}/{sym}-1h-{y}-{m:02d}.parquet"


def get(url, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and out.stat().st_size > 0:
        return
    r = subprocess.run(["curl", "-sS", "-L", "--retry", "3", "--max-time", "300", "-o", str(out), url])
    if r.returncode != 0:
        print("FAILED", url, file=sys.stderr)


def main():
    for sym in C.UNIVERSE:
        get(MD.format(sym=sym), RAW / "mdeacey" / f"{sym}_H1.csv")
    for sym in C.EXTENDED:
        for y in range(2017, 2027):
            for m in range(1, 13):
                if (y, m) > (2026, 10):
                    break
                out = RAW / "speirsy11" / f"{sym}-1h-{y}-{m:02d}.parquet"
                get(SP.format(sym=sym, y=y, m=m), out)
                if out.exists() and out.stat().st_size < 200:  # 404 body / LFS stub
                    out.unlink()
    print("raw data in", RAW)


if __name__ == "__main__":
    main()
