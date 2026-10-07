// TB-BRAIN: market-state engine. Pure functions over daily closes (no fs, no network, no orders).
// Every number in the snapshot carries its definition (the `defs` block), and every regime label carries
// the exact rule that produced it. Paper research only; this module does not decide anything by itself.
//
// Inputs are the bot's own compact daily rows [openMs, close, quoteVolume] (data/daily) and, for the arm
// rules, the same ctx shape momentum2.mjs uses ({ closeAt(p,t), universeAt(t) }). Nothing here mutates its input.
import { regimeSeries } from './strategies/regime.mjs';
import { tier2Targets } from './momentum2.mjs';
import { tier2EmaTargets, volScale, ALT70_DEFAULTS } from './alt70.mjs';

export const DAY = 86_400_000;
const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const iso = (t) => new Date(t).toISOString();
const d10 = (t) => iso(t).slice(0, 10);
const fin = (x) => (Number.isFinite(x) ? x : null);

/** Compact rows -> [{t, c}] ascending, duplicates dropped, non-positive closes skipped. */
export function closesOf(rows) {
  const m = new Map();
  for (const r of rows ?? []) { const t = Number(r[0]), c = Number(r.length >= 8 ? r[4] : r[1]); if (c > 0) m.set(t, c); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, c]) => ({ t, c }));
}

/** EMA seeded with the SMA of the first n closes (the same seed as strategies/regime.mjs). null until seeded. */
export function emaSeries(bars, n) {
  const a = 2 / (n + 1), out = [];
  let ema = null, sum = 0;
  for (let i = 0; i < bars.length; i++) {
    const c = bars[i].c;
    if (i < n) { sum += c; if (i === n - 1) ema = sum / n; }
    else ema = a * c + (1 - a) * ema;
    out.push(ema);
  }
  return out;
}

const at = (bars, t) => { let lo = 0, hi = bars.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k; };

/** Bars up to and including t (decision at the close of t). */
export const upTo = (bars, t) => bars.slice(0, at(bars, t) + 1);

/** Annualised realised vol of daily log returns over the last n returns ending at the last bar. */
export function realizedVol(bars, n = 30) {
  if (bars.length < n + 1) return null;
  const r = [];
  for (let i = bars.length - n; i < bars.length; i++) r.push(Math.log(bars[i].c / bars[i - 1].c));
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  const v = r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, r.length - 1);
  return Math.sqrt(v) * Math.sqrt(365);
}

/** Percentile (0..100) of the current n-day vol among the daily vol readings of the last `lookback` days. */
export function volPercentile(bars, n = 30, lookback = 365) {
  if (bars.length < n + 2) return null;
  const vals = [];
  const from = Math.max(n + 1, bars.length - lookback);
  for (let i = from; i <= bars.length; i++) { const v = realizedVol(bars.slice(0, i), n); if (v !== null) vals.push(v); }
  if (vals.length < 20) return null;
  const cur = vals[vals.length - 1];
  return r2(100 * vals.filter((v) => v <= cur).length / vals.length);
}

/** Close vs the highest close of the last `days` bars (inclusive): 0 = at the high, -0.25 = 25 % below. */
export function drawdownFromHigh(bars, days = 90) {
  if (!bars.length) return null;
  const w = bars.slice(-days);
  const hi = Math.max(...w.map((b) => b.c));
  return hi > 0 ? bars[bars.length - 1].c / hi - 1 : null;
}

/** Simple return over `days` calendar days (close at t vs the last close at or before t - days). */
export function returnOver(bars, t, days) {
  const i = at(bars, t), j = at(bars, t - days * DAY);
  if (i < 0 || j < 0 || i === j) return null;
  return bars[i].c / bars[j].c - 1;
}

/**
 * BTC trend block at the close of t: close, EMA50/100/200 with distance %, the EMA200 10-day slope %, and the bot's
 * regime states (EMA200 for the alt sleeves / A arms, EMA100 for the M5-B100 core): ON above, OFF after `offAfter`
 * consecutive closes below (strategies/regime.mjs, unchanged).
 */
export function btcTrend(btcBars, t, { offAfter = 3, slopeDays = 10 } = {}) {
  const bars = upTo(btcBars, t);
  if (bars.length < 2) return null;
  const close = bars[bars.length - 1].c;
  const out = { as_of: d10(bars[bars.length - 1].t), close, ema: {}, regime: {} };
  for (const n of [50, 100, 200]) {
    const e = emaSeries(bars, n), v = e[e.length - 1], prev = e[e.length - 1 - slopeDays] ?? null;
    out.ema[`ema${n}`] = v === null ? null : { value: r2(v), dist_pct: r2((close / v - 1) * 100), slope_pct_10d: prev === null || prev === undefined ? null : r2((v / prev - 1) * 100) };
  }
  for (const n of [100, 200]) {
    const s = regimeSeries(bars, { ema_n: n, off_after: offAfter }), last = s[s.length - 1];
    let below = 0; for (let i = s.length - 1; i >= 0 && s[i].ema !== null && s[i].close < s[i].ema; i--) below++;
    out.regime[`ema${n}`] = { on: last.on, closes_below: below, rule: `ON when a daily close is above EMA${n}; OFF after ${offAfter} consecutive closes below (the bot's regime rule)` };
  }
  out.dd90 = { pct: r2((drawdownFromHigh(bars, 90) ?? 0) * 100), def: 'close vs the highest daily close of the last 90 days' };
  out.ret = { d7: fin(r4(returnOver(bars, t, 7))), d28: fin(r4(returnOver(bars, t, 28))), d84: fin(r4(returnOver(bars, t, 84))) };
  const rv = realizedVol(bars, 30);
  out.vol = { rv30_ann: rv === null ? null : r4(rv), pct_1y: volPercentile(bars, 30, 365), def: 'std of 30 daily log returns x sqrt(365); percentile among the daily readings of the last 365 days' };
  return out;
}

/** Share of `pairs` whose close at t is above their own EMA(n) (pairs with fewer than n+1 bars are not counted). */
export function breadth(barsByPair, pairs, t, n) {
  let above = 0, total = 0;
  for (const p of pairs) {
    const bars = upTo(barsByPair[p] ?? [], t);
    if (bars.length < n + 1) continue;
    const e = emaSeries(bars, n)[bars.length - 1];
    if (e === null) continue;
    total++; if (bars[bars.length - 1].c > e) above++;
  }
  return { above, total, pct: total ? r2(100 * above / total) : null, def: `% of the listed pairs whose close is above their own EMA${n} (SMA-seeded)` };
}

/** Equal-weight simple return of a basket over `days`; pairs without both closes are skipped. */
export function basketReturn(barsByPair, pairs, t, days) {
  const rs = pairs.map((p) => returnOver(barsByPair[p] ?? [], t, days)).filter((x) => x !== null);
  if (!rs.length) return { n: 0, mean: null, median: null };
  const s = [...rs].sort((a, b) => a - b);
  return { n: rs.length, mean: r4(rs.reduce((a, b) => a + b, 0) / rs.length), median: r4(s[s.length >> 1]) };
}

/** Alt basket vs BTC over several windows: rel = (1 + basket) / (1 + btc) - 1. */
export function relativeStrength(barsByPair, pairs, btcBars, t, windows = [28, 84]) {
  const out = {};
  for (const d of windows) {
    const b = basketReturn(barsByPair, pairs, t, d), btc = returnOver(btcBars, t, d);
    out[`d${d}`] = { basket_mean: b.mean, basket_median: b.median, n: b.n, btc: fin(r4(btc)), rel_mean: b.mean === null || btc === null ? null : r4((1 + b.mean) / (1 + btc) - 1) };
  }
  out.def = 'equal-weight basket of the pairs listed in `pairs` (tier-2 universe at t) vs BTC, simple returns over the window; rel = (1+basket)/(1+btc)-1';
  return out;
}

/**
 * Regime label. The rules are the whole definition; there is no hidden scoring.
 *   risk-on            : BTC EMA200 regime ON  AND close > EMA50 AND breadth(EMA200) >= 50 %
 *   neutral            : BTC EMA200 regime ON  AND (close <= EMA50 OR breadth(EMA200) < 50 %)
 *   capitulation-watch : BTC EMA200 regime OFF AND drawdown from the 90-day high <= -25 % AND 30-day vol percentile >= 80
 *   risk-off           : BTC EMA200 regime OFF otherwise
 */
export function regimeLabel({ ema200On, closeAboveEma50, breadth200Pct, dd90Pct, volPct1y }) {
  const b = breadth200Pct === null || breadth200Pct === undefined ? null : breadth200Pct;
  if (ema200On) {
    if (closeAboveEma50 && (b === null || b >= 50)) return { label: 'risk-on', rule: `BTC EMA200 regime ON and close > EMA50 and breadth(EMA200) ${b === null ? 'n/a' : `${b} % >= 50 %`}` };
    return { label: 'neutral', rule: `BTC EMA200 regime ON but ${!closeAboveEma50 ? 'close <= EMA50' : ''}${!closeAboveEma50 && b !== null && b < 50 ? ' and ' : ''}${b !== null && b < 50 ? `breadth(EMA200) ${b} % < 50 %` : ''}` };
  }
  if (dd90Pct !== null && dd90Pct <= -25 && volPct1y !== null && volPct1y >= 80) return { label: 'capitulation-watch', rule: `BTC EMA200 regime OFF and drawdown from the 90-day high ${dd90Pct} % <= -25 % and 30-day vol percentile ${volPct1y} >= 80` };
  return { label: 'risk-off', rule: `BTC EMA200 regime OFF (drawdown ${dd90Pct} %, vol percentile ${volPct1y})` };
}

/**
 * What the tested arm rules say at the close of t, computed from data only (independent of the live paper state).
 * ctx: { closeAt(p,t), universeAt(t) } as in momentum2.mjs; params = the arm's resolved params (variants.mjs).
 */
export function armRules(ctx, t, btcBars, arms) {
  const b = btcTrend(btcBars, t);
  const out = {};
  const monday = new Date(t).getUTCDay() === 1;
  for (const [id, a] of Object.entries(arms)) {
    const P = { ...ALT70_DEFAULTS, ...a.params };
    const altOn = b.regime.ema200.on;
    const tg = (P.alt_ema_filter ? tier2EmaTargets(ctx, t, P) : tier2Targets(ctx, t, P));
    const targets = tg.ranked.filter((p) => ctx.closeAt(p, t) > 0).slice(0, P.slots);
    if (a.kind === 'ml2') {
      out[id] = { kind: 'ml2', regime: { ema200: altOn }, says: altOn ? 'hold the tier-2 top-5' : 'cash (regime off: every sleeve lot is sold at the next open)',
        targets: altOn ? targets : [], tier2_top: tg.ranked.slice(0, 10), universe_n: tg.universe.length, next_review: monday ? 'this close is a Monday review' : 'next Monday close (or a regime turn-on close)',
        rule: 'S3-M0: tier-2 momentum (rel90 rank, universe positions 11..40 without ETH), BTC EMA200 regime, weekly, 5 slots, turnover control' };
    } else {
      const coreOn = b.regime.ema100.on;
      const weights = { alt: altOn ? r4(P.alt_weight) : 0, core: coreOn ? r4(1 - P.alt_weight) : 0 };
      out[id] = { kind: 'alt70', regime: { ema200_alt: altOn, ema100_core: coreOn },
        says: `${altOn ? `alt sleeve ${Math.round(P.alt_weight * 100)} % in the tier-2 top-5` : 'alt sleeve in cash'}; ${coreOn ? `core ${Math.round((1 - P.alt_weight) * 100)} % in BTC` : 'core in cash'}`,
        target_weights: weights, cash_weight: r2(1 - weights.alt - weights.core), targets: altOn ? targets : [], core: coreOn ? [P.core_pair] : [], tier2_top: tg.ranked.slice(0, 10), universe_n: tg.universe.length,
        next_review: monday ? 'this close is a Monday review' : 'next Monday close (core: daily; a regime turn-on close enters at the next open)',
        rule: P.alt_ema_filter ? `C8: M5-B100 with an own-EMA${P.alt_ema_filter} filter on candidates and exact weekly replacement` : 'M5-B100: 70 % tier-2 momentum (S3-M0 rules, BTC EMA200 regime) + 30 % BTC on the BTC EMA100 regime, weekly' };
      if (a.vol_target) {
        const held = [...(altOn ? targets : []), ...(coreOn ? [P.core_pair] : [])];
        const vs = volScale({ closeAt: ctx.closeAt, pairs: held, t, days: a.vol_days ?? 7, target: a.vol_target });
        out[id].tv_overlay = { scale: vs.scale, basket_vol_ann: vs.basket_vol, pairs: held, days: a.vol_days ?? 7, target: a.vol_target,
          effective_weights: { alt: r4(weights.alt * vs.scale), core: r4(weights.core * vs.scale) },
          def: `scale = min(1, ${a.vol_target} / basket vol); basket vol = mean over the held pairs of the annualised std of the last ${a.vol_days ?? 7} daily log returns (TB-PREDICT M5-B100-TV; NOT a tested edge: it lowered MaxDD in both test periods and cost return)` };
      }
    }
  }
  return out;
}

/**
 * Historical evidence for "BTC falls -> buy alts?": for every Monday close in [from, t - horizon], the forward
 * `horizon`-day return of BTC and of the equal-weight tier-2 basket (ctx.universeAt at that Monday), split by the BTC
 * EMA200 regime state at that close and by whether BTC then fell more than `btcDropPct` over the horizon.
 */
export function altVsBtcByRegime(ctx, btcBars, t, { from = null, horizon = 28, tier = [10, 40], btcDropPct = 5 } = {}) {
  const reg = regimeSeries(btcBars, { ema_n: 200, off_after: 3 });
  const regAt = new Map(reg.map((r) => [Math.floor(r.t / DAY), r.on]));
  const rows = [];
  const start = from ?? btcBars[0].t;
  for (let d = start; d <= t - horizon * DAY; d += DAY) {
    if (new Date(d).getUTCDay() !== 1) continue;
    const on = regAt.get(Math.floor(d / DAY)); if (on === undefined) continue;
    const b0 = ctx.closeAt('BTCUSDT', d), b1 = ctx.closeAt('BTCUSDT', d + horizon * DAY);
    if (!(b0 > 0 && b1 > 0)) continue;
    const uni = ctx.universeAt(d).filter((p) => p !== 'BTCUSDT' && p !== 'ETHUSDT').slice(tier[0], tier[1]);
    const rs = uni.map((p) => { const a = ctx.closeAt(p, d), z = ctx.closeAt(p, d + horizon * DAY); return a > 0 && z > 0 ? z / a - 1 : null; }).filter((x) => x !== null);
    if (rs.length < 3) continue;
    rows.push({ t: d, on, btc: b1 / b0 - 1, alt: rs.reduce((a, b) => a + b, 0) / rs.length, n: rs.length });
  }
  const stat = (xs) => {
    if (!xs.length) return { weeks: 0 };
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
    return { weeks: xs.length, btc_median: r4(med(xs.map((x) => x.btc))), alt_median: r4(med(xs.map((x) => x.alt))), alt_mean: r4(xs.reduce((s, x) => s + x.alt, 0) / xs.length),
      alts_beat_btc_pct: r2(100 * xs.filter((x) => x.alt > x.btc).length / xs.length), alts_positive_pct: r2(100 * xs.filter((x) => x.alt > 0).length / xs.length) };
  };
  const drop = rows.filter((x) => x.btc <= -btcDropPct / 100);
  return {
    def: `Monday closes from ${d10(start)}; forward ${horizon}-day simple returns; alt basket = equal weight of the tier-2 universe (positions ${tier[0] + 1}..${tier[1]} by 90-day volume, no BTC/ETH) at that Monday; regime = BTC EMA200 rule at that close`,
    horizon_days: horizon, weeks: rows.length,
    regime_on: stat(rows.filter((x) => x.on)), regime_off: stat(rows.filter((x) => !x.on)),
    btc_drop: { def: `weeks where BTC fell more than ${btcDropPct} % over the horizon`, all: stat(drop), regime_on: stat(drop.filter((x) => x.on)), regime_off: stat(drop.filter((x) => !x.on)) },
    btc_up: stat(rows.filter((x) => x.btc > 0)),
  };
}

/**
 * Full snapshot at the close of t.
 * @param daily     {pair: compact rows}
 * @param ctx       { closeAt, universeAt } (point-in-time universe; see bot.mjs signals)
 * @param arms      {id: {kind: 'alt70'|'ml2', params, vol_target?, vol_days?}}
 */
export function marketState({ daily, ctx, arms = {}, t = null, historyFrom = null }) {
  const bars = Object.fromEntries(Object.entries(daily).map(([p, rows]) => [p, closesOf(rows)]));
  const btc = bars.BTCUSDT;
  if (!btc?.length) throw new Error('no BTCUSDT daily closes');
  const asOf = t ?? btc[btc.length - 1].t;
  const trend = btcTrend(btc, asOf);
  const uni = ctx.universeAt(asOf).filter((p) => p !== 'BTCUSDT');
  const tier2 = uni.filter((p) => p !== 'ETHUSDT').slice(10, 40);
  const listed = Object.keys(bars).filter((p) => p !== 'BTCUSDT' && (bars[p].at(-1)?.t ?? 0) >= asOf - 3 * DAY);
  const br50 = breadth(bars, uni, asOf, 50), br200 = breadth(bars, uni, asOf, 200);
  const brAll50 = breadth(bars, listed, asOf, 50), brAll200 = breadth(bars, listed, asOf, 200);
  const rel = relativeStrength(bars, tier2, btc, asOf, [28, 84]);
  const eth = bars.ETHUSDT ? { d28: fin(r4(returnOver(bars.ETHUSDT, asOf, 28))), d84: fin(r4(returnOver(bars.ETHUSDT, asOf, 84))), vs_btc_28: fin(r4((1 + returnOver(bars.ETHUSDT, asOf, 28)) / (1 + returnOver(btc, asOf, 28)) - 1)) } : null;
  const label = regimeLabel({ ema200On: trend.regime.ema200.on, closeAboveEma50: trend.ema.ema50 ? trend.close > trend.ema.ema50.value : true, breadth200Pct: br200.pct, dd90Pct: trend.dd90.pct, volPct1y: trend.vol.pct_1y });
  return {
    label: 'PAPER research snapshot from public daily closes; rule outputs, not advice',
    as_of: d10(asOf), as_of_ms: asOf, data_last_close: d10(btc[btc.length - 1].t), pairs_with_data: Object.keys(bars).length,
    btc: trend, eth,
    breadth: { eligible_universe: { ema50: br50, ema200: br200, n: uni.length, def: 'the bot\'s eligible USDT universe at t (Owner rules, top 40 by 90-day volume), BTC excluded' },
      all_listed: { ema50: brAll50, ema200: brAll200, n: listed.length, def: 'every USDT pair in the data snapshot with a close in the last 3 days (incl. memes, stables and ineligible names)' } },
    alt_vs_btc: { ...rel, tier2_pairs: tier2 },
    regime: label,
    arms: armRules(ctx, asOf, btc, arms),
    evidence_alts_when_btc_falls: altVsBtcByRegime(ctx, btc, asOf, { from: historyFrom ?? btc[0].t + 100 * DAY }),
    defs: {
      ema: 'EMA seeded with the SMA of the first n closes (the bot\'s regime EMA); dist_pct = close / EMA - 1',
      regime_ema200: 'ON when a daily close is above EMA200; OFF after 3 consecutive closes below (the A arms and the alt sleeves)',
      regime_ema100: 'the same rule on EMA100 (the M5-B100 / C8 BTC core sleeve)',
      dd90: 'close vs the highest daily close of the last 90 days, in %',
      vol: 'annualised std of daily log returns (30 d); percentile among the last 365 daily readings',
      breadth: '% of pairs with a close above their own EMA50 / EMA200',
      alt_vs_btc: 'equal-weight tier-2 basket (eligible universe positions 11..40 by volume, no BTC/ETH) vs BTC over 28 / 84 days',
      arms: 'targets recomputed from data only (the live paper state may lag or lead by a day); next fills are at the next open after a Monday close',
    },
  };
}
