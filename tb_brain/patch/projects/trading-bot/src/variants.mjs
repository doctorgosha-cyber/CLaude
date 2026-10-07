// Forward-paper variants of strategy A (config.forward.variants; pre-registered in
// work/TB-FWD/FORWARD-PREREGISTRATION.md). Params only: the strategy files stay untouched; regime
// MA type, weighting and review cadence are runner options.
import { regimeSeries } from './strategies/regime.mjs';

export const WEIGHTINGS = ['equal_at_entry', 'equal_weekly_relevel', 'inv_vol_30d'];
export const CADENCES = ['weekly', 'monthly_first_monday'];
export const MA_TYPES = ['EMA', 'SMA'];

/** Defaults = the frozen A (research.regime, research.allocation, config.universe). */
export const variantDefaults = (config) => ({
  regime_ma_type: 'EMA',
  regime_ma_len: config.research.regime.ema_n,
  off_closes: config.research.regime.off_after,
  top_n: config.research.allocation.top_n,
  weighting: 'equal_at_entry',
  cadence: 'weekly', // weekly = every Monday close; monthly_first_monday = first Monday close of the month
  reweight_min_trade_pct: 1, // re-weighted variants: skip a re-weight trade smaller than this % of the bucket
  vol_days: 30, // inv_vol_30d: daily close-to-close log returns over this many days
  universe: {}, // overrides of config.universe (min_listed_days, emission limits, denylist, ...)
  review_on_regime_turn: false, // A4 (Amendment 4): a regime turn-on at a close triggers a review (immediate entry)
  reserve_dip: null, // A5 (Amendment 4): 'C2v2' = reserve dip-buy BTC/ETH 70/30, tranches at 70/60/50 % of the 365-day high
  fixed_targets: null, // B4 (Amendment 6): a fixed target set instead of the volume top-N, e.g. ["BTCUSDT","ETHUSDT"]
  lt_weights: null, // LT variants (Amendment 6): longterm DCA buys only these pairs, the largest value deficit first
  breakout: null, // A7 (Amendment 6): { entry_days, exit_days, max_hold_days } (strategy "breakout" only)
});
export const DIP_RULES = ['C2v2'];

/** Amendment 1: rules every variant shares (not variant params). */
export const MIN_HISTORY_BARS = 30; // an asset needs 30 closed daily bars at the review to be eligible
export const WEIGHT_CAP_MULT = 2; // inv_vol per-name cap = 2 / top_n; the excess stays in USDT
export const VARIANT_KEYS = ['id', 'strategy', 'params'];

/**
 * Universe overrides may only TIGHTEN the Owner rules (listing age, emission, longterm rank, denylist).
 * Memes, stablecoins and leveraged tokens are hard rules in src/universe.mjs and cannot be overridden.
 */
const TIGHTEN = {
  min_listed_days: (v, b) => Number.isFinite(v) && v >= b,
  lt_min_listed_days: (v, b) => Number.isFinite(v) && v >= b,
  max_emission_pct: (v, b) => Number.isFinite(v) && v <= b,
  lt_max_emission_pct: (v, b) => Number.isFinite(v) && v <= b,
  capped_max_emission_pct: (v, b) => Number.isFinite(v) && (b === null || v <= b), // null would remove the cap: refused
  lt_top_n: (v, b) => Number.isInteger(v) && v >= 1 && v <= b,
  denylist: (v, b) => Array.isArray(v) && b.every((x) => v.map((y) => String(y).toUpperCase()).includes(String(x).toUpperCase())),
};

/** Resolve and validate one variant. Throws on anything unknown (a typo must not silently fall back). */
export function resolveVariant(config, v) {
  if (!v || typeof v.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(v.id) || v.id === 'bars' || v.id === 'guard') throw new Error(`variant id must match [A-Za-z0-9_-]{1,40} and not be "bars"/"guard" (got ${v?.id})`);
  for (const k of Object.keys(v)) if (!VARIANT_KEYS.includes(k)) throw new Error(`variant ${v.id}: unknown key ${k} (allowed: ${VARIANT_KEYS.join(', ')})`);
  if (v.strategy === 'rel') return resolveRel(config, v);
  if (v.strategy === 'ml2') return resolveMl2(config, v);
  if (v.strategy === 'alt70') return resolveAlt70(config, v);
  if (!['regime', 'breakout'].includes(v.strategy)) throw new Error(`variant ${v.id}: only strategies "regime", "breakout", "rel", "ml2" and "alt70" are supported (got ${v.strategy})`);
  const d = variantDefaults(config);
  const p = v.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new Error(`variant ${v.id}: params must be an object`);
  for (const k of Object.keys(p)) if (!(k in d)) throw new Error(`variant ${v.id}: unknown param ${k}`);
  const params = { ...d, ...p, universe: { ...(p.universe ?? {}) } };
  for (const [k, val] of Object.entries(params.universe)) {
    if (!(k in TIGHTEN)) throw new Error(`variant ${v.id}: universe param ${k} cannot be overridden`);
    if (!TIGHTEN[k](val, config.universe[k])) throw new Error(`variant ${v.id}: universe.${k}=${JSON.stringify(val)} would loosen the Owner rule (${JSON.stringify(config.universe[k])}); overrides may only tighten`);
  }
  if (!MA_TYPES.includes(params.regime_ma_type)) throw new Error(`variant ${v.id}: regime_ma_type must be one of ${MA_TYPES}`);
  if (!WEIGHTINGS.includes(params.weighting)) throw new Error(`variant ${v.id}: weighting must be one of ${WEIGHTINGS}`);
  if (!CADENCES.includes(params.cadence)) throw new Error(`variant ${v.id}: cadence must be one of ${CADENCES}`);
  for (const k of ['regime_ma_len', 'off_closes', 'top_n', 'vol_days']) {
    if (!Number.isInteger(params[k]) || params[k] < 1) throw new Error(`variant ${v.id}: ${k} must be a positive integer`);
  }
  if (!(params.reweight_min_trade_pct >= 0)) throw new Error(`variant ${v.id}: reweight_min_trade_pct must be >= 0`);
  if (typeof params.review_on_regime_turn !== 'boolean') throw new Error(`variant ${v.id}: review_on_regime_turn must be true or false`);
  if (params.reserve_dip !== null && !DIP_RULES.includes(params.reserve_dip)) throw new Error(`variant ${v.id}: reserve_dip must be null or one of ${DIP_RULES}`);
  if (params.reserve_dip && !config.forward?.profit_split) throw new Error(`variant ${v.id}: reserve_dip needs forward.profit_split`);
  const pairRe = /^[A-Z0-9]{2,15}USDT$/;
  if (params.fixed_targets !== null && (!Array.isArray(params.fixed_targets) || !params.fixed_targets.length || params.fixed_targets.some((p) => !pairRe.test(p)))) throw new Error(`variant ${v.id}: fixed_targets must be a non-empty list of USDT pairs`);
  if (params.lt_weights !== null) {
    const w = params.lt_weights;
    if (typeof w !== 'object' || Array.isArray(w) || !Object.keys(w).length || Object.keys(w).some((p) => !pairRe.test(p)) || Object.values(w).some((x) => !(x > 0))
      || Math.abs(Object.values(w).reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new Error(`variant ${v.id}: lt_weights must map USDT pairs to positive weights summing to 1`);
  }
  if (v.strategy === 'breakout') {
    const b = { entry_days: 20, exit_days: 10, max_hold_days: 20, ...(params.breakout ?? {}) };
    for (const k of Object.keys(b)) if (!['entry_days', 'exit_days', 'max_hold_days'].includes(k) || !Number.isInteger(b[k]) || b[k] < 2) throw new Error(`variant ${v.id}: breakout.${k} invalid`);
    params.breakout = b;
  } else if (params.breakout !== null) throw new Error(`variant ${v.id}: breakout params need strategy "breakout"`);
  return {
    id: v.id, strategy: v.strategy, params,
    universe: { ...config.universe, ...params.universe },
    regime: { ma: params.regime_ma_type, n: params.regime_ma_len, off_after: params.off_closes },
    // the shape portfolioDay expects (research params)
    run: {
      allocation: { top_n: params.top_n, weighting: params.weighting, cadence: params.cadence === 'weekly' ? 'weekly_monday' : params.cadence,
        reweight_min_trade_pct: params.reweight_min_trade_pct, vol_days: params.vol_days,
        min_history_bars: MIN_HISTORY_BARS, weight_cap_mult: WEIGHT_CAP_MULT, review_on_regime_turn: params.review_on_regime_turn,
        ...(params.fixed_targets ? { fixed_targets: [...params.fixed_targets] } : {}) },
      momentum: config.research.momentum,
      dip: params.reserve_dip === 'C2v2' ? true : null,
      ...(params.lt_weights ? { lt_weights: { ...params.lt_weights } } : {}),
      ...(params.breakout ? { breakout: { ...params.breakout } } : {}),
    },
  };
}

/** A6 "alts vs BTC" (TB-REL R4, Amendment 5): fixed frame, only these params, defaults = R4. */
export const REL_PARAM_DEFAULTS = Object.freeze({ core_pct: 0.5, slots: 4, slot_pct: 0.125, sma_days: 90, reselect: 'monthly_first_close', universe: {} });
function resolveRel(config, v) {
  const p = v.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new Error(`variant ${v.id}: params must be an object`);
  for (const k of Object.keys(p)) if (!(k in REL_PARAM_DEFAULTS)) throw new Error(`variant ${v.id}: unknown param ${k}`);
  const params = { ...REL_PARAM_DEFAULTS, ...p, universe: { ...(p.universe ?? {}) } };
  for (const [k, val] of Object.entries(params.universe)) {
    if (!(k in TIGHTEN)) throw new Error(`variant ${v.id}: universe param ${k} cannot be overridden`);
    if (!TIGHTEN[k](val, config.universe[k])) throw new Error(`variant ${v.id}: universe.${k}=${JSON.stringify(val)} would loosen the Owner rule; overrides may only tighten`);
  }
  if (!Number.isInteger(params.slots) || params.slots < 1 || !Number.isInteger(params.sma_days) || params.sma_days < 2) throw new Error(`variant ${v.id}: slots/sma_days invalid`);
  if (Math.abs(params.core_pct + params.slots * params.slot_pct - 1) > 1e-9 || params.core_pct < 0 || params.slot_pct <= 0) throw new Error(`variant ${v.id}: core_pct + slots x slot_pct must be 1`);
  if (params.reselect !== 'monthly_first_close') throw new Error(`variant ${v.id}: reselect must be monthly_first_close`);
  if (!config.forward?.profit_split) throw new Error(`variant ${v.id}: rel needs forward.profit_split`);
  return {
    id: v.id, strategy: 'rel', params, universe: { ...config.universe, ...params.universe },
    regime: { ma: 'EMA', n: config.research.regime.ema_n, off_after: config.research.regime.off_after }, // unused (status only)
    rel: { core_pct: params.core_pct, slots: params.slots, slot_pct: params.slot_pct, sma_days: params.sma_days, reselect: params.reselect, min_history_bars: MIN_HISTORY_BARS },
    run: { allocation: { min_history_bars: MIN_HISTORY_BARS } },
  };
}

/** S3-M0 "ml2" (TB-RECENT2/3 research engine, forward Amendment 7): fixed frame, only these params, defaults = S3-M0. */
export const ML2_PARAM_DEFAULTS = Object.freeze({ slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90, turnover_min_fresh: 2, regime_ma_len: 200, off_closes: 3, universe: {} });
function resolveMl2(config, v) {
  const p = v.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new Error(`variant ${v.id}: params must be an object`);
  for (const k of Object.keys(p)) if (!(k in ML2_PARAM_DEFAULTS)) throw new Error(`variant ${v.id}: unknown param ${k}`);
  const params = { ...ML2_PARAM_DEFAULTS, ...p, universe: { ...(p.universe ?? {}) } };
  for (const [k, val] of Object.entries(params.universe)) {
    if (!(k in TIGHTEN)) throw new Error(`variant ${v.id}: universe param ${k} cannot be overridden`);
    if (!TIGHTEN[k](val, config.universe[k])) throw new Error(`variant ${v.id}: universe.${k}=${JSON.stringify(val)} would loosen the Owner rule; overrides may only tighten`);
  }
  for (const k of ['slots', 'universe_top', 'tier_to', 'lookback_days', 'turnover_min_fresh', 'regime_ma_len', 'off_closes']) if (!Number.isInteger(params[k]) || params[k] < 1) throw new Error(`variant ${v.id}: ${k} must be a positive integer`);
  if (!Number.isInteger(params.tier_from) || params.tier_from < 0 || params.tier_from >= params.tier_to) throw new Error(`variant ${v.id}: tier_from must be an integer in [0, tier_to)`);
  if (!config.forward?.profit_split) throw new Error(`variant ${v.id}: ml2 needs forward.profit_split (HWM 10/45/45)`);
  return {
    id: v.id, strategy: 'ml2', params, universe: { ...config.universe, ...params.universe },
    regime: { ma: 'EMA', n: params.regime_ma_len, off_after: params.off_closes },
    ml2: { slots: params.slots, universe_top: params.universe_top, tier_from: params.tier_from, tier_to: params.tier_to, exclude: ['ETHUSDT'], lookback_days: params.lookback_days, turnover_min_fresh: params.turnover_min_fresh, lt_min_buy_usdt: config.longterm.min_buy_usdt },
    run: { allocation: { min_history_bars: 0 } },
  };
}

/**
 * "Alt 70/30" two-sleeve arms (TB-ARM1314, forward Amendment 8): M5-B100 (TB-ALT70) and C8 (FULGRIM-STRAT R2 C8).
 * Alt sleeve = S3-M0 rules on the BTC EMA<alt_regime_ma_len> regime; core sleeve = BTC only on the BTC EMA<core_regime_ma_len>
 * regime. C8: alt_ema_filter 50 (own EMA50 trend filter) and alt_turnover false (exact weekly replacement).
 */
export const ALT70_PARAM_DEFAULTS = Object.freeze({ alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90, turnover_min_fresh: 2,
  alt_regime_ma_len: 200, core_regime_ma_len: 100, off_closes: 3, alt_turnover: true, alt_ema_filter: null, universe: {} });
/**
 * TB-BRAIN proposal M5-B100-TV (TB-PREDICT target-vol overlay): optional alt70 params `vol_target` (annualised, e.g. 0.6) and
 * `vol_days` (default 7 = the 168 h window of the research, on daily closes). They join the resolved params ONLY when a variant
 * sets them, so the live M5-B100 / C8 params and fingerprints are byte-identical. OFF by default: not in config.forward.variants.
 * Labelled NOT A PROVEN EDGE: in TB-PREDICT it lowered MaxDD in both periods at a return cost; Sharpe was flat in development.
 */
export const ALT70_TV_PARAMS = Object.freeze({ vol_target: null, vol_days: 7 });
export const M5_B100_TV_PROPOSAL = Object.freeze({ id: 'M5-B100-TV', strategy: 'alt70', params: { alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90, turnover_min_fresh: 2,
  alt_regime_ma_len: 200, core_regime_ma_len: 100, off_closes: 3, alt_turnover: true, alt_ema_filter: null, vol_target: 0.6, vol_days: 7 } });
function resolveAlt70(config, v) {
  const p = v.params ?? {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new Error(`variant ${v.id}: params must be an object`);
  for (const k of Object.keys(p)) if (!(k in ALT70_PARAM_DEFAULTS) && !(k in ALT70_TV_PARAMS)) throw new Error(`variant ${v.id}: unknown param ${k}`);
  const tv = {};
  if ('vol_target' in p || 'vol_days' in p) {
    tv.vol_target = p.vol_target ?? null; tv.vol_days = p.vol_days ?? ALT70_TV_PARAMS.vol_days;
    if (tv.vol_target !== null && !(tv.vol_target > 0 && tv.vol_target <= 3)) throw new Error(`variant ${v.id}: vol_target must be null or in (0, 3] (annualised)`);
    if (!Number.isInteger(tv.vol_days) || tv.vol_days < 2 || tv.vol_days > 90) throw new Error(`variant ${v.id}: vol_days must be an integer in [2, 90]`);
  }
  const params = { ...ALT70_PARAM_DEFAULTS, ...p, ...tv, universe: { ...(p.universe ?? {}) } };
  for (const [k, val] of Object.entries(params.universe)) {
    if (!(k in TIGHTEN)) throw new Error(`variant ${v.id}: universe param ${k} cannot be overridden`);
    if (!TIGHTEN[k](val, config.universe[k])) throw new Error(`variant ${v.id}: universe.${k}=${JSON.stringify(val)} would loosen the Owner rule; overrides may only tighten`);
  }
  for (const k of ['slots', 'universe_top', 'tier_to', 'lookback_days', 'turnover_min_fresh', 'alt_regime_ma_len', 'core_regime_ma_len', 'off_closes']) if (!Number.isInteger(params[k]) || params[k] < 1) throw new Error(`variant ${v.id}: ${k} must be a positive integer`);
  if (!Number.isInteger(params.tier_from) || params.tier_from < 0 || params.tier_from >= params.tier_to) throw new Error(`variant ${v.id}: tier_from must be an integer in [0, tier_to)`);
  if (!(params.alt_weight > 0 && params.alt_weight < 1)) throw new Error(`variant ${v.id}: alt_weight must be in (0, 1)`);
  if (typeof params.alt_turnover !== 'boolean') throw new Error(`variant ${v.id}: alt_turnover must be true or false`);
  if (params.alt_ema_filter !== null && !(Number.isInteger(params.alt_ema_filter) && params.alt_ema_filter >= 2)) throw new Error(`variant ${v.id}: alt_ema_filter must be null or an integer >= 2`);
  if (!config.forward?.profit_split) throw new Error(`variant ${v.id}: alt70 needs forward.profit_split (HWM 10/45/45)`);
  return {
    id: v.id, strategy: 'alt70', params, universe: { ...config.universe, ...params.universe },
    regime: { ma: 'EMA', n: params.alt_regime_ma_len, off_after: params.off_closes }, // alt sleeve (status / ctx.regimeOn)
    core_regime: { ma: 'EMA', n: params.core_regime_ma_len, off_after: params.off_closes },
    alt70: { alt_weight: params.alt_weight, slots: params.slots, universe_top: params.universe_top, tier_from: params.tier_from, tier_to: params.tier_to, exclude: ['ETHUSDT'],
      lookback_days: params.lookback_days, turnover_min_fresh: params.turnover_min_fresh, alt_turnover: params.alt_turnover, alt_ema_filter: params.alt_ema_filter,
      core_pair: 'BTCUSDT', lt_min_buy_usdt: config.longterm.min_buy_usdt, ...(tv.vol_target ? { vol_target: tv.vol_target, vol_days: tv.vol_days } : {}) },
    run: { allocation: { min_history_bars: 0 } },
  };
}

export function resolveVariants(config) {
  const seen = new Set();
  return (config.forward?.variants ?? []).map((v) => {
    const r = resolveVariant(config, v);
    if (seen.has(r.id)) throw new Error(`duplicate variant id ${r.id}`);
    seen.add(r.id);
    return r;
  });
}

/**
 * Regime series for a variant. EMA delegates to strategies/regime.mjs unchanged (the frozen path);
 * SMA applies the same on/off rule to a simple moving average (runner-side, no strategy file change).
 */
export function regimeSeriesFor(daily, { ma = 'EMA', n = 200, off_after = 3 } = {}) {
  if (ma === 'EMA') return regimeSeries(daily, { ema_n: n, off_after });
  if (ma !== 'SMA') throw new Error(`unknown regime ma ${ma}`);
  const out = [];
  let sum = 0, on = false, below = 0;
  for (let i = 0; i < daily.length; i++) {
    const c = daily[i].c;
    sum += c;
    if (i >= n) sum -= daily[i - n].c;
    const m = i >= n - 1 ? sum / n : null;
    if (m !== null) {
      if (c > m) { on = true; below = 0; }
      else if (c < m) { below++; if (below >= off_after) on = false; }
    }
    out.push({ t: daily[i].t, close: c, ema: m, on });
  }
  return out;
}

/**
 * Capital config the A variants run with: config.capital with forward.profit_split (Owner rule 3,
 * 10/45/45) instead of the legacy reinvest_share. Research and the swing forward keep config.capital.
 */
export function variantCapital(config) {
  const ps = config.forward?.profit_split;
  if (!ps) return config.capital;
  const { reinvest_share, ...rest } = config.capital;
  const mode = config.forward?.profit_split_mode;
  return { ...rest, profit_split: { ...ps }, ...(mode ? { profit_split_mode: mode } : {}) };
}

/** Everything that must match for a saved forward state to be resumed. */
export const variantFingerprint = (config, rv) => ({
  strategy: rv.strategy, params: rv.params, rules: { min_history_bars: MIN_HISTORY_BARS, weight_cap_mult: WEIGHT_CAP_MULT }, universe: rv.universe, capital: config.capital, costs: config.costs, longterm: config.longterm,
  candidates_top: config.research.candidates_top, rank_window_days: config.real.rank_window_days, quote: config.real.quote,
});
