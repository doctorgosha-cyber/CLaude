"""TB-PREDICT configuration. Everything that is a research choice lives here
and is frozen in PREREG.md before the holdout is evaluated."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"          # processed 1h parquet per symbol (committed)
RAW_DIR = ROOT.parent / "data_raw"  # raw downloads (not committed)
TABLES_DIR = ROOT / "tables"

# ---------------------------------------------------------------- universe
MAJORS = ["BTCUSDT", "ETHUSDT"]
# Fixed list of 20 liquid alts, all listed on Binance spot by 2020-08.
# XMRUSDT was delisted 2024-02 (kept: survivorship control).
ALTS = ["BNBUSDT", "XRPUSDT", "ADAUSDT", "LTCUSDT", "BCHUSDT", "EOSUSDT", "XLMUSDT",
        "TRXUSDT", "LINKUSDT", "ETCUSDT", "XMRUSDT", "NEOUSDT", "ATOMUSDT", "VETUSDT",
        "DOGEUSDT", "MATICUSDT", "ALGOUSDT", "XTZUSDT", "ZECUSDT", "SOLUSDT"]
UNIVERSE = MAJORS + ALTS
# Symbols whose history extends to 2026-10 (second data mirror). The other 12
# alts end 2024-03-14 (first mirror).
EXTENDED = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "TRXUSDT",
            "DOGEUSDT", "ZECUSDT", "BCHUSDT", "SOLUSDT"]

# ---------------------------------------------------------------- periods
DATA_START = "2019-01-01"
# Development (walk-forward OOS) period: predictions whose timestamp falls in
# [DEV_START, HOLDOUT_START). Earlier bars are only used for training/warm-up.
DEV_START = "2020-01-01"
# Primary untouched holdout: last 12 months of data (10 extended symbols).
HOLDOUT_START = "2025-10-01"
HOLDOUT_END = "2026-10-04"
# Secondary holdout for the 12 alts whose data ends 2024-03-14: their last 12
# months. Those (symbol, date) rows are masked out of every development-phase
# table and evaluated once, together with the primary holdout.
HOLDOUT_B_START = "2023-03-15"
HOLDOUT_B_END = "2024-03-15"
HOLDOUT_B_SYMBOLS = [s for s in ALTS if s not in EXTENDED]

# ---------------------------------------------------------------- costs
FEE = 0.001        # 0.1 % per side
SLIPPAGE = 0.0005  # 0.05 % per side
COST_SIDE = FEE + SLIPPAGE

# ---------------------------------------------------------------- walk-forward
HORIZONS = {  # name -> (pandas resample rule, bars per year, purge bars, embargo bars)
    "4h": ("4h", 6 * 365, 1, 42),    # embargo 7 days = 42 bars
    "1d": ("1D", 365, 1, 7),
    "1w": ("W-MON", 52, 1, 1),
}
TRAIN_YEARS = 3           # rolling training window length
TEST_BLOCK_MONTHS = 3     # refit every quarter, predict the next quarter
MIN_TRAIN_ROWS = 2000

# ---------------------------------------------------------------- models
LGBM_PARAMS = dict(n_estimators=300, learning_rate=0.03, num_leaves=15, max_depth=4,
                   min_child_samples=200, subsample=0.8, subsample_freq=1,
                   colsample_bytree=0.8, reg_lambda=5.0, verbose=-1, n_jobs=4)
LOGIT_C = 0.1
SEED = 7

# ---------------------------------------------------------------- calm regime
CALM_RV_WINDOW_H = 72        # realized vol over last 72 hourly bars
CALM_RV_MEDIAN_DAYS = 90     # vs rolling median of that RV over 90 days
CALM_SIGMA_DAYS = 30         # sigma for the 3-sigma shock test: 30-day std of 1h returns
CALM_SHOCK_SIGMAS = 3.0
CALM_VOL_Z_MAX = 2.0         # 72h volume z-score (vs 30-day) must be < 2

# ---------------------------------------------------------------- trading rules
PROB_THRESHOLD = 0.55        # long when P(up) > threshold, else cash (spot bot)
VOL_TARGET_ANNUAL = 0.60     # target-vol sizing for Q3 (annualised); cap leverage at 1
