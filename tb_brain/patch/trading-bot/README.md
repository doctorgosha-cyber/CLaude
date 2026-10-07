# bot-z: Binance Spot PAPER-trading bot with bucketed capital (swing-only)

## Коротко українською
- **Що це.** Паперовий (симульований) бот для Binance Spot. Він бере **реальні публічні ринкові дані** Binance, але **ніколи не відправляє ордери** й не використовує API-ключі. `--live` відмовляє (код виходу 3).
- **Капітал (рішення Власника, TB-PAPER-2).** Скальпінг вимкнено. Swing 1130, reserve 300. Резерв ніколи не торгується й не поповнюється. 50% чистого прибутку йде в swing, решта в longterm. Longterm тільки купує, раз на добу.
- **Монети.** Без мемкоїнів, стейблкоїнів, левереджних токенів і без емісії >5%/рік, з капом чи без. Longterm («надійні»): лістинг ≥ 1095 днів, ранг ≤ 20, емісія ≤ 5%/рік.
- **Ранг.** Медіанний денний обсяг за 90 днів до дати рішення. Рахується серед **усіх** USDT-пар з exchangeInfo, включно з призупиненими (BREAK), без стейблкоїнів і левереджних токенів. Пари, повністю видалені з exchangeInfo, відсутні.
- **Перевірка режимів ринку** (ті самі заморожені параметри swing; це не оптимізація):

| вікно | swing net | бот | BTC hold | рівновагово |
|---|---|---|---|---|
| альтсезон 2020-10..2021-05 | −85.50 | +44.75% | +244.66% | +560.95% |
| ведмідь 2022 | −253.83 | −20.46% | −64.31% | −67.54% |
| альт-ралі 2024-10..2025-03 | +296.42 | +14.98% | +29.96% | +33.03% |
| поточне 2026-04..2026-09 | +300.54 | +31.41% | +22.10% | +98.46% |

- **Висновок.** Swing-стратегія не має стабільної переваги: вона прибуткова у 2 з 4 вікон. Бот сильно відстає від простого утримання на зростанні, а на падінні втрачає набагато менше (головно через резерв і невикористаний кеш).
- **Не фінансова порада.**

**Label: DEMO (paper only).** Market data is LIVE and public. Fills, positions and PnL are simulated (MOCK fills). There is no order path of any kind.

## How to run
You need Node 22 or newer. There are no dependencies.
```
npm test                                   # node:test suite, fully offline (fixtures)
node scripts/fetch-data.mjs                # cache public data under data/ (first run: about 15 min, about 135 MB)
node bot.mjs --regimes                     # all windows -> out/regimes-summary.json
node bot.mjs --replay [--window=<id>]      # one window (default current-2026) -> out/replay-summary.json, replay-trades.jsonl
node bot.mjs --paper-forward --once        # one forward step on the latest CLOSED public 15m bars (for a scheduler)
node bot.mjs --paper-forward               # the same, looping after every 15m close
node bot.mjs --paper                       # deterministic run on SYNTHETIC fixtures (test baseline)
node bot.mjs --live                        # refused, exit code 3
```
Windows Task Scheduler (creating the task is the Owner's decision):
```
schtasks /Create /SC MINUTE /MO 15 /TN botz-paper /TR "node \"C:\Users\docto\OneDrive\Desktop\NEXUS-CLAUDE\projects\trading-bot\bot.mjs\" --paper-forward --once --quiet"
```

## Forward paper: A variants (TB-FWD), labelled NO PROVEN EDGE
The OOS was opened once and no candidate passed (`out/OOS-OPENED.json`, `out/oos-compare.json`). The Owner chose to run strategy A forward in several pre-registered variants (`work/TB-FWD/FORWARD-PREREGISTRATION.md`), next to the swing forward run. **Every arm is labelled "no proven edge".** Paper only: real public Binance daily klines, simulated fills, no orders.
```
node bot.mjs --paper-forward --once --all            # every variant in config.forward.variants, in turn, each under its own lock
node bot.mjs --paper-forward --once --variant=A2     # one variant
node bot.mjs --paper-status [--json]                 # swing + every variant: equity, open positions, trades, regime, last bar, balances
```
- **Variants** (`config.forward.variants`, params only; the strategy files are unchanged):

  | id | change vs A0 |
  |---|---|
  | A0 | none: frozen A (EMA200, off after 3 closes, top 5, equal weight at entry, weekly) |
  | A1 | `off_closes: 1` |
  | A2 | `weighting: inv_vol_30d` |
  | A3 | `off_closes: 1` and `inv_vol_30d` |

  - Params and their frozen-A defaults:
    - `regime_ma_type` (EMA | SMA), `regime_ma_len` (200), `off_closes` (3), `top_n` (5);
    - `weighting` (equal_at_entry | equal_weekly_relevel | inv_vol_30d);
    - `cadence` (weekly | monthly_first_monday);
    - `reweight_min_trade_pct` (1), `vol_days` (30);
    - `universe` (overrides of `config.universe`, e.g. `min_listed_days`).
  - Unknown params, and unknown top-level variant keys (only `id`, `strategy`, `params`), are refused.
  - `universe` overrides may only tighten the Owner rules: `min_listed_days` and `lt_min_listed_days` up, emission limits and `lt_top_n` down, `denylist` a superset; `capped_max_emission_pct: null` is refused. Memes, stablecoins and leveraged tokens are hard rules and cannot be overridden.
- **Amendment 2: bootstrap review** (`forward.bootstrap_review: true`):
  - On the first daily close a variant processes after init, the normal review runs once on any weekday: same universe, ranks, weights and caps, filled at the next open. If the regime is off at that close, nothing happens except setting the flag. Afterwards the normal Monday cadence applies.
  - The `bootstrapped` flag lives in the portfolio state. A state without the flag counts as not bootstrapped only if it has 0 trades, 0 rebalances and 0 positions.
  - The flag is part of the fingerprint for states created after Amendment 2 only. Older states keep their fingerprint and run without exit 4; there is no migration.
- **Amendment 1 rules (every variant):**
  - An asset needs 30 closed daily bars at the review to be eligible. On the design data this changes nothing for A0: 52 trades, own DD 33.84 %, identical trades.
  - `trades` counts new lot entries only. `rebalances` (trims and top-ups) are counted apart and logged to `out/forward-<id>-rebalances.jsonl`.
  - **Freshness gate:**
    - a day is processed only if every held or pending pair and every eligible candidate has that day's closed bar (OHLC and volume);
    - otherwise the run refetches once, then returns `retry` with nothing committed (exit 0).
  - SMA, the re-weighting and the cadence live in the runner (`src/variants.mjs`, `src/portfolio.mjs`). With the defaults, the runner is byte-equivalent to the pre-refactor one; this is tested against a frozen copy in `test/legacy/`.
- **inv_vol_30d.**
  - Weights are proportional to 1 / stdev of the 30 daily log returns ending at the review close (closed bars only), as a fraction of the investable amount (the bucket's marked-to-market equity).
  - Each name is capped at 2/top_n (40 %), and the excess stays in USDT.
  - A target without a valid vol is dropped and its 1/n share stays in USDT; it is never renormalised onto the others.
  - It re-weights at every review, filling at the next open: full sales for dropped names, partial trims for overweights, top-ups for underweights.
  - A re-weight trade smaller than 1 % of the bucket is skipped. minNotional and stepSize are respected.
  - Partial sales go through `applyClosedTrade` like any sale.
  - A top-up adds to an existing lot. That can mean buying more of a position that is down; it is the pre-registered rule, so this is disclosed here rather than blocked.
- **Amendment 6 (TB-ADD):** each arm has its own bank 1430 with the HWM 10/45/45 split.
  - **B4:** BTC/ETH 50/50 at entry under the EMA200 regime (3 closes off, immediate on); reserve idle.
  - **A7** (`strategy: "breakout"`):
    - on the top-5 eligible names, at equal weight, it buys at the next open when the close is the highest of the last 20 closes;
    - it exits at the next open when the close is the lowest of the last 10, or after 20 days;
    - no regime filter.
  - **A5-LTbtc / A5-LTdef:** A5 whose longterm DCA buys only BTC, or BNB/ETH/BTC 40/40/20. All LT cash goes to the target with the largest value deficit, valued at the previous close.
  - **XRP:** emission is now 6 %/yr (source note in `config/assets.json`), so XRP is ineligible.
    - This metadata also feeds research and replays, and it has no `supply_history`, so 6 % applies to every window.
    - The design compare no longer reproduces the frozen numbers (e.g. A: 52 → 58 trades, own DD 33.84 → 37.79 %). The frozen and OOS evidence files are untouched.
- **Amendment 5: A6 "alts vs BTC"** (`strategy: "rel"`, `src/relative.mjs`; TB-REL R4):
  - 50 % BTC core plus 4 slots of 12.5 % on the top-4 eligible alts (monthly re-selection). Each slot holds its alt while ALT/BTC > SMA90, otherwise BTC.
  - Fills are on the direct ALT/BTC pair where it exists (one fee), else via USDT (two fees). The refresh fetches the daily klines of every TRADING BTC-quote pair of the pool.
  - The HWM split applies per sold leg, and the exported share is sold to USDT. The reserve is never traded.
  - Status shows the slots (`alt:holding`) and equity in BTC units (`--json`).
- **Amendment 4 (TB-HWM): HWM split, A4, A5.**
  - **HWM split** (`forward.profit_split_mode: "hwm"`, Owner rule 3 sub-rule):
    - each account (the active bucket, and the reserve's own dip account) tracks its cumulative realized PnL and its peak, in cents;
    - only the part of a result above the previous peak is split 10/45/45; the rest of a profit stays 100 % with that account, and a loss stays with it too;
    - the peak never decreases;
    - research keeps the legacy per-trade path.
  - **A4** = A0 plus immediate entry: a regime turn-on at a daily close triggers the review (buy at the next open). The Monday reviews continue.
  - **A5** = A4 plus the reserve dip-buy C2v2. This is the only rule that may spend the reserve.
    - H = BTC's 365-day closing high. When the BTC close is ≤ 70 / 60 / 50 % of H, the reserve buys BTC/ETH 70/30 at the next open: 1/3 of the free reserve, then 1/2 of the rest, then the rest. The minimum is 15 USDT per leg.
    - A tranche re-arms only after a new 365-day high.
    - Exit: when the BTC close is ≥ the H recorded at that buy, the lot is sold at the next open. The cost basis returns to the reserve and the result goes through the HWM split on the reserve's account.
    - Status shows the dip lots, the armed tranches and the reserve's marked-to-market value.
- **Amendment 3: profit split 10/45/45** (Owner rule 3, `OWNER-RULES.md`; `forward.profit_split`):
  - The realized net profit of every closed trade, sale or trim goes 45 % to the active bucket, 45 % to longterm (buy-only) and 10 % to the reserve.
  - Booking is in integer cents: active and reserve take the floor, and longterm takes the rest including the residue. Losses come only from the active bucket.
  - The reserve is never traded (`canOpen`, risk and the runners refuse it). It only accumulates the 10 % credits; a dip-buy rule does not exist yet.
  - `--paper-status` and `out/forward-<id>-summary.json` show the reserve balance and its growth.
  - Research and the existing swing forward state keep `config.capital` (legacy `reinvest_share` 0.5), so the frozen A reproduction is unchanged. Moving the swing forward to the new split needs a fresh swing state.
- **Each variant has its own paper bank** (swing 1130, reserve 300, profits split 10/45/45):
  - `state/<id>/paper-state.json` (the single commit point) and `state/<id>/daily-extra.json` (data cache);
  - outputs `out/forward-<id>-trades.jsonl`, `-longterm-buys.jsonl`, `-daily.jsonl`, `-summary.json` and `-runs.jsonl`.
- **The daily log** (`out/forward-<id>-daily.jsonl`) has one row per processed UTC day: regime state, BTC close and MA, review targets and weights, positions with weights, cash and equity. The dates are identical across arms, so exits can be read as paired events (reading rule 1).
- **Guarantees** (the same as the swing forward run):
  - **Daily refresh:**
    - the whole rank pool's 1d klines are fetched (closed only), at most once per UTC day once yesterday's BTC bar is in;
    - the refresh runs inside the lock, after the config check;
    - a fetch error means `retry`, nothing is written and the exit code is 0.
  - **Processing:** only days after the last processed day, up to the last closed BTC day.
  - **Commit and restarts:**
    - jsonl output is appended before the atomic state commit and trimmed back on restart;
    - a re-run at the same clock is idle;
    - a state created with other params or capital is refused with exit 4.
  - **First run:** history only. Trading starts with the next closed day; there is no backfill.
  - `--live` is refused.
- **Scheduling** (creating the task is the Owner's decision):
  - Run `--all` a few times a day, e.g. hourly; extra runs are idle.
  - The swing task above stays as it is. The swing state (`state/paper-state.json`) is separate and untouched.

## Delisting guard, stuck-pair freeze, S3-M0 (TB-GUARD, forward Amendment 7)
- **Daily refresh** (`src/guard.mjs`; only on the first `--all` run of each UTC day; network via `lib/public-market-data.mjs` only):
  - the public exchangeInfo → `state/guard/exchangeInfo-live.json` (status and filters of known pairs; new listings are not added to the rank pool);
  - the Monitoring Tags (public binance.com product list) and the "Binance Will Delist …" announcements (public catalog 161) → `state/guard/tags.json`, seeded from `data/guard-seed/monitoring-tags.json` (TB-RECENT3);
  - a failed fetch keeps the last files and logs `GUARD WARNING`. A run never stops because of it. Everything is logged in `state/guard/guard-log.jsonl`.
- **G2:** a tagged, announced or non-TRADING name is never a new buy in any arm. A held one is sold at the next open after any daily close. Longterm holdings are never sold (Owner rule 3); a flagged one is only reported.
- **Freeze:** a held pair that is not TRADING keeps its last close, is flagged `frozen`, gets no orders, and is excluded from the freshness gate, so the arm keeps running. The freeze is logged once per day. `--paper-status` prints an `ESCALATION` line for it.
- **S3-M0** (`src/momentum2.mjs`, strategy `ml2`): tier-2 momentum (rel90 rank, universe positions 11–40 without ETH), the BTC EMA200 filter, turnover control, 5 slots, and its own 1430 bank. Parity with TB-RECENT3: `test/ml2-parity.test.mjs` (fixture `fixtures/ml2-parity/ohlc.json`).
- `config.forward.guard` (`enabled`, `seed`) is not part of any fingerprint.

## Arms 13 M5-B100 and 14 C8 "Alt 70/30" (TB-ARM1314, forward Amendment 8)
- `src/alt70.mjs`, strategy `alt70`: a day-step port of TB-ALT70 engineA with two sleeves. The **alt sleeve** (70 % of the active book) runs S3-M0's rules on the BTC EMA200 regime. The **core sleeve** (30 %) holds BTC only, on the BTC EMA100 regime with daily review. Own 1430 bank, HWM 10/45/45, G2 and freeze as S3-M0.
- **C8** = M5-B100 plus two alt-sleeve changes (`alt_ema_filter: 50`, `alt_turnover: false`): a candidate must close above its own EMA50, and the weekly list is replaced exactly.
- `--paper-status` shows both regimes (`regime alt on/core off`).
- Tests: `test/alt70.test.mjs` covers resolution, existing-arm fingerprints, the BTC core guard/regime, the freeze, the C8 EMA50 exit, and live-runner parity for 2026-02-02..10-03.
- Full 2021-11 → 2026-10 engine parity (4216.50 / C8 design +26.77 %): `work/TB-ARM1314/parity-research.mjs` (needs the research panel).
- Both arms are labelled NO PROVEN EDGE (C8: FULGRIM-STRAT NOT FOUND).

## TB-BRAIN: сигнали та стан ринку (`node bot.mjs signals`, read-only)
- `src/market-state.mjs` — чисті функції над денними закриттями: тренд BTC (EMA50/100/200, дистанція, нахил), режими EMA200/EMA100 за правилом бота, просадка від 90-денного максимуму, реалізована волатильність і її перцентиль, широта (частка монет вище EMA50/200), tier-2 кошик проти BTC (28/84 д), мітка режиму з точним правилом, і те, що правила M5-B100 / C8 / S3-M0 (та пропозиція M5-B100-TV) вимагають зараз. Кожне число має визначення (`defs`).
- `src/signals.mjs` — «що кажуть протестовані правила»: статус українською, рівень доказів кожного правила (посилання на TB-звіт), головні ризики, відповідь на питання власника з даних, фіксований дисклеймер. Без цін-цілей, без плеча, без «купуй зараз».
- `node bot.mjs signals [--out=dir] [--state=dir] [--now=<ISO>] [--asof=<YYYY-MM-DD>]` → `out/signals.json`, `out/signals.md`, `out/market-state.json`. Офлайн: читає `data/daily`, `config/assets.json`, `data/exchangeInfo.json` (якщо немає — пул виводиться з файлів даних і це позначається) і `state/*/paper-state.json` (тільки читання). Жодного шляху ордерів.
- **M5-B100-TV (пропозиція, OFF за замовчуванням):** `variants.mjs` → `M5_B100_TV_PROPOSAL`: M5-B100 плюс параметри `vol_target: 0.6`, `vol_days: 7`. Розмір купівлі в `alt70.mjs` множиться на `min(1, vol_target / річна волатильність кошика за vol_days денних закриттів)` (рішення на закритті, виконання на наступному відкритті; наявні лоти не підрізаються). Параметри приєднуються до `params` лише коли вони задані, тож живі M5-B100 / C8 (fingerprint) незмінні. Не доведена перевага: у TB-PREDICT оверлей знижував MaxDD в обох періодах ціною дохідності. Встановлення — лише через tb-safe-install (NEXUS), додавши запис до `config.forward.variants`.
- Тести: `test/market-state.test.mjs`, `test/signals.test.mjs`, `test/alt70-tv.test.mjs`.

## Capital (`src/capital.mjs`, `config.capital`)
- **Default (TB-PAPER-2).** `split { scalp: 0, swing: 1130, reserve: 300 }`, `enabled_buckets ['swing']`, `reinvest_targets ['swing']`, `reinvest_share 0.5`.
- **Disabling a bucket.** A disabled bucket must have split 0, and it never signals, trades or receives reinvest. Every enabled bucket must be greater than 0, and the reserve must be strictly smaller than every enabled bucket. `reinvest_targets` must be a subset of the enabled buckets, with no duplicates. The split must sum to the bank (±0.01).
- **Re-enabling scalp.** The scalp code is kept. Set `enabled_buckets ['scalp','swing']`, a split such as 450/680/300, and `reinvest_targets ['scalp','swing']` (this layout is `LEGACY_SCALP_SWING_CONFIG`).
- **Booking.** Amounts are kept in integer cents. Profit: `floor(P × 0.5)` goes to swing, and the rest plus cent residue goes to longterm. Loss: it comes from the originating bucket only, and the overdraw check uses unrounded values. The reserve is never touched.
- **Leakage.** A bucket keeps only part of its own profit but absorbs all of its losses. With swing-only, swing keeps 50% of its profit; in the old layout it kept about 30%.

## Data (`scripts/fetch-data.mjs`, public endpoints only)
| what | endpoint | used for |
|---|---|---|
| exchangeInfo, **all statuses** | `data-api.binance.vision/api/v3/exchangeInfo` | rank pool (TRADING + BREAK), lot size and min notional |
| daily klines, **every USDT pair** (708 after removing leveraged tokens) | `data-api.binance.vision/api/v3/klines?interval=1d` | listing age (first kline), 90-day volume ranks; cached in `data/daily/` |
| 15m klines | `data.binance.vision/data/spot/monthly/klines/...zip` | replay bars; kept zipped and read with `node:zlib`. Falls back to daily zips, then `/api/v3/klines`, for months not yet published |

- All network access goes through `lib/public-market-data.mjs`: one `fetch`, GET only, host and path allowlist, no key handling. A test enforces this.
- Which 15m pairs are downloaded is decided by the same point-in-time rules the replay uses (`src/realdata.mjs`). Nothing is hand-picked.

## Eligibility (`src/universe.mjs`, `src/realdata.mjs`)
- **Rank (`volumeRank90d`).** For each decision date, the rank is the median daily quote volume over the 90 complete days **before** that date. The pool is **every USDT spot pair in exchangeInfo, whatever its current status**.
  - Excluded from the pool: leveraged tokens (rule on the base asset), stablecoins by metadata, and stable-like pairs by price (every close within ±3% of the median).
  - A pair that had not been listed yet, or had already stopped trading, counts as 0 volume on those days.
- **Limit on that claim.** The rank is point-in-time **over the pairs Binance still lists in exchangeInfo**. Pairs that Binance removed entirely are missing, so a residual survivorship bias remains.
- **Trading (`isEligible`).** An asset is rejected if it has a meme tag, is on the denylist, is a stablecoin, is a leveraged token, is missing supply data, was listed fewer than 365 days ago (from its first kline), or has emission above 5%/yr (with or without a cap).
- **Trade universe.** It is the top 10 eligible pairs by rank **at the window start** that traded the day before. It is fixed for the window.
- **Longterm.** The rule (listed ≥ 1095 days, rank ≤ 20, emission ≤ 5%/yr) is re-evaluated **every UTC day**.
- **Emission.** Assets with `supply_history` use the rate in force on that date: BTC, BCH and LTC halvings; the ETH merge and Dencun; the SOL inflation schedule; ZEC halvings. All other assets use the 2026 snapshot in every window.

## Engine, forward loop
- **Signals and fills.** One `step()` (`src/engine.mjs`) serves the fixture run, the replay and the forward mode. A signal on the close of bar *t* fills at the next bar's open, with fee and slippage. Stops are resting orders.
- **Risk (swing).** Positions are capped at 34% of the bucket, with at most 2 open. The daily loss limit is 4%. The kill switch triggers at a 20% drawdown of the strategy's own realized equity and stays on for the rest of the run.
- **Drawdowns are reported twice.**
  - `strategy_own_mtm_dd_pct`: the starting split plus the strategy's own net PnL plus open PnL, with no reinvest flows.
  - `bucket_mtm_dd_pct`: the ledger bucket, including the profit that leaks to longterm.
- **Forward run (`src/forward.mjs`).**
  - It takes a lock and fetches closed bars only.
  - The fetch is all-or-nothing: on a network failure the run logs `retry`, leaves state untouched and exits 0.
  - It processes only bars after `lastT`. It appends output first, then commits state with temp+rename, and trims uncommitted lines after a crash.
  - It refuses a state created under a different capital config, with exit code 4 so a scheduler can see it. The daily refresh runs inside the lock, after that check.
  - The first run loads history only. Daily volumes for the whole trading pool are refreshed once per UTC day.

## Research: strategies V2 (`proposals/TB-STRATEGY-V2.md`)
```
node scripts/fetch-data.mjs --research=design      # data only: daily OHLC + 15m for the design window
node bot.mjs --compare --window=design [--strategy=swing|regime|momentum|swing-regime]   -> out/design-compare.json
node bot.mjs --freeze                              # one-time: <project>/out/FROZEN.json (fixed path; --out is ignored)
node scripts/fetch-data.mjs --research=oos         # NEXUS only
node --max-old-space-size=6144 bot.mjs --compare --oos     # NEXUS only, ONCE; refuses (exit 5) unless FROZEN.json matches, or if out/OOS-OPENED.json exists
```
- **Lock scope.** FROZEN.json holds the sha256 of every file under `src/` and `lib/` (recursive), every file under `config/`, and `bot.mjs`, plus the parameters (`research`, `swing`, `risk`, `costs`, `capital`, `universe`, `longterm`, `real`). A changed, added or removed file in that scope, or a changed parameter, refuses the OOS.
- **Open once.** `--compare --oos` creates `<project>/out/OOS-OPENED.json` exclusively before any OOS number is computed (an aborted run still counts as opened), then seals it with the sha256 of `oos-compare.json`. A second open, and any re-freeze after it, exits 5. `--strategy` is refused with `--oos`.
- **Strategies.** All of them run on the single active bucket (swing 1130). The Owner rules are unchanged.
  - **A `regime`.** When the BTC 1D close is above EMA200 the regime is on; it turns off after 3 consecutive closes below. When on, hold the top 5 eligible assets at equal weight at entry; they are reviewed at the Monday close and filled at the Tuesday open. When off, sell everything at the next open.
    - **Equal weight at entry only.** Each new position gets 1/5 of the bucket at its fill. Held positions are never re-levelled: the weekly review only sells assets that left the top 5 and buys the new ones, so weights drift with prices between entries.
  - **B `momentum`.** The same regime filter. Each week, hold the top 3 eligible assets by 90-day return, and keep an asset until it leaves the top 6.
  - **C `swing-regime`.** The existing swing entry, taken only when the regime was on at the previous daily close. It exits on a completed 4h close below EMA50; the initial ATR stop stays and there is no trailing stop. The swing risk limits, including the permanent kill switch, are unchanged.
  - **D `swing-wide` (Amendment 2).** The unchanged swing rules with the ATR stop multiple ×2 (`research.swing_wide.stop_atr_mult`; 4 ATR for both the initial and the trailing stop). The swing risk limits, including the kill switch, are unchanged. It is applied as runner params only, and it was selected on design data from the TB-STOPS 16-cell grid, so it carries multiple-testing risk.
  - **`swing`.** The TB-PAPER-2 strategy.
- **Universe.** "Eligible" means the top 10 eligible assets by point-in-time 90-day volume rank. For A and B it is re-evaluated weekly; for C and swing, monthly.
- **Fills and accounting.** Every sale is a whole lot and goes through `applyClosedTrade`. Fills are at the next open with fee and slippage. A and B have no stop or kill switch; the regime filter is their only risk control.
- **Pass criteria (proposal + OOS pre-registration, Amendment 1).** All must hold:
  - strategy-own CAGR / strategy-own MaxDD beats each hold's CAGR / MaxDD (BTC hold, and equal-weight hold of the top 10 at the window start);
  - strategy-own MaxDD ≤ 35%;
  - total-equity net > 0 at stress costs (0.10% + 0.15%), unchanged;
  - the best asset's realized net PnL ÷ the sum of positive per-asset net PnL (share of gross profit) ≤ 50%.
  - **Strategy-own equity** = the active bucket's starting capital (1130) + cumulative raw netPnl, marked to market including open positions. Total-equity and bucket metrics stay in the output as `total_equity_secondary` / `bucket_secondary` and are not criteria (the longterm bucket is buy-only, never sold).
  - Ties and the winner among passing strategies: higher strategy-own CAGR/MaxDD (`ranking`, `winner` in the compare JSON).
- **Protocol.** Any run that touches dates on or after 2024-01-01 with the new strategies needs a valid `out/FROZEN.json`. `--strategy` other than swing is refused outside `--compare`.

## Risks and honest caveats
- **Regime check, not proof.** Swing had a positive net in only 2 of the 4 windows. In the three rising windows the bot trailed equal-weight holding every time, and BTC in two of the three (it beat BTC in 2026: 31.41% vs 22.10%).
- **Survivorship.** Pairs Binance removed from exchangeInfo are missing.
- **Metadata hindsight.** The supply metadata was written in 2026, with hindsight; FTT and LUNA are included on the same rules. The `LUNAUSDT` series mixes Terra Classic and Terra 2.0.
- **Fills.** Costs are flat. There is no order book, no partial fills and no latency.
- **Market risk.** Crypto spot can lose 20–70%; the 2022 holds lost about two thirds.

## Rollout plan
1. **Paper forward (this build)** for at least 4–8 weeks. Compare it with BTC and equal-weight holding.
2. **Testnet** (Owner-gated, not implemented).
3. **Pilot** (Owner-gated): a small fraction of capital, withdrawals disabled, IP allowlist, kill switch on.

There is no order code in this repository. **Not financial advice.**
