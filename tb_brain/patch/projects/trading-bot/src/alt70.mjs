// "Alt 70/30" two-sleeve arms (forward Amendment 8): M5-B100 (TB-ALT70) and C8 (FULGRIM-STRAT R2 C8).
// A day-step port of the research engine work/TB-ALT70/scripts/engineA.mjs runSleeves with two sleeves:
//   sleeve "alt"  w 0.70, slots 5: tier-2 momentum exactly as S3-M0 (src/momentum2.mjs tier2Targets), on the BTC EMA200
//                 regime (on above, off after 3 closes below), turnover control (rotate only with >= 2 new names);
//                 C8: a candidate must also close above its own EMA50 (seeded with the first observed close, valid after
//                 50 observed closes; research core.mjs E50) and must have a finite rel90; the target list is replaced
//                 weekly WITHOUT the turnover threshold, so a name that fails EMA50 leaves at the next Monday review;
//   sleeve "core" w 0.30, slots 1: BTCUSDT only, on the BTC EMA100 regime (same 3-close off rule), reviewed daily
//                 (a regime turn-on close enters at the next open; a Monday close re-checks the target).
// Shared rules (engineA): decisions at the Monday close, at a sleeve's regime turn-on close and at the first processed
// close; fills at the next open, sells first (pending order kept; the HWM split is order-dependent), then buys;
// buy size = min(w x book / slots, w x 0.25 x book x (slots > 4 ? 1 : 4 / slots), active cash), book = active cash +
// cost of ALL open sleeve lots; regime off at a close -> every lot of that sleeve is sold (lot order);
// bank = capital.split (active 1130 + reserve 300); HWM 10/45/45 split of realized active profit; the reserve is never
// traded; longterm cash buys the longterm-eligible names by volume rank at the open (buy-only); NET valuation.
// TB-GUARD (as the live S3-M0): blocked names never enter (also not via longterm DCA), a held blocked name is sold at the
// next open (daily review), frozen lots keep their last close, get no orders and leave the rotation.
// Simulated fills only; this module never sends orders.
import { tier2Targets } from './momentum2.mjs';

const DAY = 86_400_000;
const r2 = (x) => Math.round(x * 100) / 100;
const r8 = (x) => Math.round(x * 1e8) / 1e8;
const iso = (t) => new Date(t).toISOString();
const floorStep = (q, s) => (s > 0 ? Math.floor(q / s + 1e-9) * s : q);
export const SLEEVES = ['alt', 'core'];
export const ALT70_DEFAULTS = Object.freeze({
  alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, exclude: ['ETHUSDT'], lookback_days: 90, turnover_min_fresh: 2,
  alt_turnover: true, alt_ema_filter: null, core_pair: 'BTCUSDT', lt_min_buy_usdt: 10,
});

export function createAlt70State(config) {
  const split = config.capital.split;
  const active = split.swing ?? 0, reserve = split.reserve ?? 0;
  return {
    kind: 'alt70', version: 1, start_total: active + reserve + (split.scalp ?? 0), reserve_start: reserve,
    cash: { active, reserve, lt: 0 }, hwm: { active: { c: 0, p: 0 }, reserve: { c: 0, p: 0 } },
    lots: [], pend: [], last: {}, seq: 0, entries: 0, nTrades: 0, wins: 0, rebalances: 0, fees: 0, traded: 0, realized: 0,
    decided: false, regime_on: null, regimes: { alt: null, core: null }, last_targets: null, perf: { peak: {}, dd: {} }, lastT: null, frozen: {},
    equity: { total: active + reserve + (split.scalp ?? 0), swing: active, swing_own: active, longterm_value: 0, longterm_cash: 0, active_cash: active, reserve },
  };
}

/**
 * Own EMA over a dense close array (NaN = no bar): seeded with the first observed close, updated with 2/(n+1) on observed
 * closes only, reported (finite) from the n-th observed close on and only on days with a close (research core.mjs E50).
 */
export function ownEma(closes, n) {
  const out = new Float64Array(closes.length).fill(NaN), k = 2 / (n + 1);
  let e = null, nb = 0;
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i]; if (!(c > 0)) continue;
    nb++; e = e === null ? c : k * c + (1 - k) * e;
    if (nb >= n) out[i] = e;
  }
  return out;
}

/**
 * TB-BRAIN proposal M5-B100-TV (from TB-PREDICT): target-vol overlay. scale = min(1, target / basket vol) where basket vol is
 * the mean over `pairs` of the annualised std of the last `days` daily log returns ending at the close of t (data <= t).
 * A pair without enough closes is skipped; with no usable pair the scale is 1 (no sizing). Pure; never used unless a
 * variant sets vol_target (the live M5-B100 / C8 params and fingerprints are untouched).
 */
export function volScale({ closeAt, pairs, t, days = 7, target }) {
  const vols = [];
  for (const p of pairs) {
    const r = [];
    for (let k = days - 1; k >= 0; k--) { const a = closeAt(p, t - k * DAY), z = closeAt(p, t - (k + 1) * DAY); if (a > 0 && z > 0) r.push(Math.log(a / z)); }
    if (r.length < days) continue;
    const m = r.reduce((s, x) => s + x, 0) / r.length, v = r.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, r.length - 1);
    vols.push(Math.sqrt(v) * Math.sqrt(365));
  }
  if (!vols.length || !(target > 0)) return { scale: 1, basket_vol: null, n: 0 };
  const bv = vols.reduce((s, x) => s + x, 0) / vols.length;
  return { scale: Math.min(1, bv > 0 ? target / bv : 1), basket_vol: Math.round(bv * 1e4) / 1e4, n: vols.length };
}

/** C8 alt targets: tier 2 (as S3-M0) with a finite rel90 and close > own EMA, by rel90 desc (ties by symbol). */
export function tier2EmaTargets(ctx, t, P) {
  const { universe, ranked } = tier2Targets(ctx, t, P);
  const C = (p, d) => { const v = ctx.closeAt(p, d); return v > 0 ? v : null; };
  const b0 = C('BTCUSDT', t), b1 = C('BTCUSDT', t - P.lookback_days * DAY);
  const raw = (p) => { const a = C(p, t), z = C(p, t - P.lookback_days * DAY); return (1 + (a / z - 1)) / (1 + (b0 / b1 - 1)) - 1; };
  return { universe, ranked: ranked.filter((p) => Number.isFinite(raw(p)) && C(p, t) > ctx.emaAt(p, t, P.alt_ema_filter)) };
}

/**
 * Process UTC day t (fills at the open, mark at the close, decisions at the close).
 * ctx: { config, params, bar(p,t)->{o,h,l,c}, closeAt(p,t), universeAt(t), ltAt(t), ranksAt(t), market(p)->{stepSize,minNotional}|null,
 *        regimes: { alt(t), core(t) }, emaAt(p,t,n) (C8), guard?: {blocked(p,t), frozen:Set}, decide = true }
 */
export function alt70Day(st, t, ctx) {
  if (st.lastT !== null && t <= st.lastT) throw new Error(`day ${iso(t)} already processed (last ${iso(st.lastT)})`);
  const P = { ...ALT70_DEFAULTS, ...(ctx.params ?? {}) };
  const SV = { alt: { w: P.alt_weight, slots: P.slots, tf: P.alt_turnover }, core: { w: 1 - P.alt_weight, slots: 1, tf: false } };
  const fee = ctx.config.costs.fee_pct / 100, slip = ctx.config.costs.slippage_pct / 100;
  const ev = { trades: [], ltBuys: [], decisions: [], rebalances: [], fills: [] };
  const G = ctx.guard ?? null;
  const blockedAt = (p, d) => (G ? G.blocked(p, d) : null);
  const frozen = (p) => !!G?.frozen?.has(p);
  const O = (p) => { const b = ctx.bar(p, t); return b && b.o > 0 ? b.o : null; };
  const Cd = (p, d) => { const b = ctx.bar(p, d); const v = b ? b.c : ctx.closeAt(p, d); return v > 0 ? v : null; };
  const filt = (p) => ctx.market(p);
  const cl = (p) => { const v = Cd(p, t); if (v) st.last[p] = v; return st.last[p] ?? 0; };
  const vn = (l) => l.qty * cl(l.pair) * (1 - slip) * (1 - fee);
  const exc = (b, g) => { const h = st.hwm[b]; h.c += g; if (h.c <= h.p) return 0; const e = h.c - h.p; h.p = h.c; return e; };
  const buy = (bucket, role, pair, usd, sleeve = null) => {
    const o = O(pair), m = filt(pair); if (!o || !m || !(usd > 0)) return null;
    usd = Math.min(usd, st.cash[bucket]);
    const p = o * (1 + slip), q = floorStep(usd / (p * (1 + fee)), m.stepSize);
    if (q <= 0 || q * p < m.minNotional) return null;
    st.cash[bucket] -= q * p * (1 + fee); st.fees += q * p * fee; if (role === 'sleeve') st.traded += q * p;
    const l = { id: `${role === 'lt' ? 'L' : 'P'}${++st.seq}`, bucket, role, ...(sleeve ? { sleeve } : {}), pair, qty: q, cost: q * p * (1 + fee), entryT: t, entryPrice: p };
    st.lots.push(l);
    if (role === 'sleeve') { st.entries++; ev.fills.push({ kind: 'buy', id: l.id, sleeve, pair, qty: r8(q), price: r8(p), cost: r8(l.cost) }); }
    else ev.ltBuys.push({ time: iso(t), symbol: pair, qty: r8(q), price: r8(p), spend_usdt: r8(l.cost) });
    return l;
  };
  const sell = (l, reason) => {
    const o = O(l.pair); if (!o) return false;
    const g0 = l.qty * o * (1 - slip), net = g0 * (1 - fee), g = net - l.cost;
    st.fees += g0 * fee; if (l.role === 'sleeve') st.traded += g0;
    st.lots = st.lots.filter((x) => x !== l);
    let e = 0;
    if (l.bucket === 'active') { st.cash.active += net; e = exc('active', g); st.cash.active -= e * 0.55; st.cash.reserve += e * 0.10; st.cash.lt += e * 0.45; }
    else { st.cash.reserve += net; e = exc('reserve', g); st.cash.reserve -= e * 0.90; st.cash.lt += e * 0.45; st.cash.active += e * 0.45; }
    st.realized += g; st.nTrades++; if (r2(g) > 0) st.wins++;
    ev.trades.push({ id: l.id, bucket: l.bucket === 'active' ? 'swing' : l.bucket, sleeve: l.sleeve ?? null, symbol: l.pair, strategy: 'alt70', entry_time: iso(l.entryT), exit_time: iso(t), qty: r8(l.qty),
      entry_price: r8(l.entryPrice), exit_price: r8(o * (1 - slip)), notional: r8(l.cost / (1 + fee)), netPnl: r2(g), netPnl_raw: r8(g), hwm_excess: r8(e), exit_reason: reason,
      cash_after: { active: r2(st.cash.active), reserve: r2(st.cash.reserve), lt: r2(st.cash.lt) } });
    return true;
  };
  const sl = (k) => st.lots.filter((l) => l.role === 'sleeve' && (k === undefined || l.sleeve === k));

  if (Cd('BTCUSDT', t)) {
    // 1) longterm DCA at the open (buy only; research rule: the k best-ranked names, k = cash / max(10, minNotional) / 1.02)
    // ctx.guardLongterm === false: research-parity switch only (the research engine has no guard on the longterm list)
    const ltP = ctx.ltAt(t).filter((p) => O(p) && filt(p) && (ctx.guardLongterm === false || !blockedAt(p, t - DAY)));
    if (ltP.length && st.cash.lt >= P.lt_min_buy_usdt) {
      const rk = ctx.ranksAt(t), r = [...ltP].sort((a, b) => rk[a] - rk[b]);
      const lm = Math.max(P.lt_min_buy_usdt, ...r.map((p) => filt(p).minNotional)) * 1.02, k = Math.min(r.length, Math.floor(st.cash.lt / lm));
      for (const p of r.slice(0, k)) buy('lt', 'lt', p, st.cash.lt / k * 0.999);
    }
    // 2) fills at the open: sells first (pending order), then buys
    const S = st.pend.filter((o) => o.k === 'sell'), B = st.pend.filter((o) => o.k === 'buy');
    st.pend = [];
    for (const o of S) {
      const l = st.lots.find((x) => x.id === o.id);
      if (!l) continue;
      if (frozen(l.pair)) { (ev.frozen_dropped ??= []).push({ pair: l.pair, lot: l.id, reason: o.reason }); continue; } // frozen: stop retrying
      if (!sell(l, o.reason)) st.pend.push(o);
    }
    // M5-B100-TV (proposal, OFF unless params.vol_target): one scale per fill day from the decision close t - 1 day over the
    // sleeve targets (pending buys + held lots); applied to the buy size only (held lots are not trimmed: entry sizing overlay)
    let tv = null;
    if (P.vol_target) {
      const tp = [...new Set([...B.map((o) => o.pair), ...sl().map((l) => l.pair)])];
      tv = volScale({ closeAt: (p, d) => Cd(p, d), pairs: tp, t: t - DAY, days: P.vol_days ?? 7, target: P.vol_target });
      ev.tv = { time: iso(t), ...tv, pairs: tp };
    }
    for (const o of B) {
      const why = frozen(o.pair) ? 'frozen' : blockedAt(o.pair, t - DAY);
      if (why) { (ev.guard ??= []).push({ time: iso(t), pair: o.pair, action: 'pending_buy_dropped', reason: why }); continue; }
      const sv = SV[o.sleeve];
      if (sl(o.sleeve).some((l) => l.pair === o.pair)) continue;
      const bk = st.cash.active + sl().reduce((s, l) => s + l.cost, 0);
      buy('active', 'sleeve', o.pair, Math.min(sv.w * bk / sv.slots, sv.w * 0.25 * bk * (sv.slots > 4 ? 1 : 4 / sv.slots), st.cash.active) * (tv ? tv.scale : 1), o.sleeve);
    }
  }
  // 3) close: mark to market (NET valuation, as the research engine)
  const sleeveVal = sl().reduce((s, l) => s + vn(l), 0), ltVal = st.lots.filter((l) => l.role === 'lt').reduce((s, l) => s + vn(l), 0);
  cl('BTCUSDT');
  const eq = { total: st.cash.active + st.cash.reserve + st.cash.lt + sleeveVal + ltVal, swing: st.cash.active + sleeveVal };
  eq.swing_own = (ctx.config.capital.split.swing ?? 0) + st.realized + sl().reduce((s, l) => s + vn(l) - l.cost, 0);
  for (const k of Object.keys(eq)) {
    st.perf.peak[k] = Math.max(st.perf.peak[k] ?? eq[k], eq[k]);
    st.perf.dd[k] = Math.max(st.perf.dd[k] ?? 0, st.perf.peak[k] > 0 ? (st.perf.peak[k] - eq[k]) / st.perf.peak[k] * 100 : 0);
  }
  st.equity = { ...eq, longterm_value: ltVal, longterm_cash: st.cash.lt, active_cash: st.cash.active, reserve: st.cash.reserve };
  st.lastT = t;
  if (ctx.decide === false || !Cd('BTCUSDT', t)) return ev;

  // 4) decisions at the close of t (data <= t)
  const first = !st.decided;
  st.decided = true;
  const ps = (l) => st.pend.some((o) => o.k === 'sell' && o.id === l.id);
  if (G) for (const l of sl()) { // G2 daily review: a held blocked name is sold at the next open
    const why = blockedAt(l.pair, t);
    if (!why || frozen(l.pair) || ps(l)) continue;
    st.pend.push({ k: 'sell', id: l.id, reason: `guard_${why}` });
    (ev.guard ??= []).push({ time: iso(t), pair: l.pair, action: 'sell_next_open', reason: why });
  }
  const on = { alt: !!ctx.regimes.alt(t), core: !!ctx.regimes.core(t) };
  const turned = { alt: on.alt && !ctx.regimes.alt(t - DAY), core: on.core && !ctx.regimes.core(t - DAY) };
  st.regimes = { ...on }; st.regime_on = on.alt || on.core;
  for (const l of sl()) if (!ps(l) && !frozen(l.pair) && !on[l.sleeve]) st.pend.push({ k: 'sell', id: l.id, reason: 'regime_off' }); // lot order
  if (!on.alt && !on.core) return ev;
  const dayDec = new Date(t).getUTCDay() === 1 || first;
  if (!dayDec && !turned.alt && !turned.core) return ev;
  const ok = (p) => !blockedAt(p, t) && !frozen(p);
  const review = { time: iso(t), reason: first ? 'first_close' : dayDec ? 'weekly' : 'regime_turn_on', sleeves: {} };
  for (const k of SLEEVES) {
    if (!on[k] || (!dayDec && !turned[k])) continue;
    const sv = SV[k];
    const held = sl(k).filter((l) => !ps(l) && !frozen(l.pair)).map((l) => l.pair);
    const ranked = k === 'core' ? [P.core_pair] : (P.alt_ema_filter ? tier2EmaTargets(ctx, t, P) : tier2Targets(ctx, t, P)).ranked;
    const gtop = ranked.filter((p) => Cd(p, t) && filt(p) && ok(p));
    let tg = gtop.slice(0, sv.slots), kept = false;
    if (sv.tf && tg.length && held.length) {
      const fresh = tg.filter((p) => !held.includes(p));
      if (fresh.length < P.turnover_min_fresh) { tg = [...held]; for (const p of fresh) if (tg.length < sv.slots) tg.push(p); kept = true; } else st.rebalances++;
    }
    if (G) { tg = tg.filter(ok); for (const p of gtop) if (tg.length < sv.slots && !tg.includes(p)) tg.push(p); }
    for (const l of sl(k)) if (!tg.includes(l.pair) && !ps(l) && !frozen(l.pair)) st.pend.push({ k: 'sell', id: l.id, reason: 'rotation' });
    for (const p of tg) if (!sl(k).some((l) => l.pair === p)) st.pend.push({ k: 'buy', sleeve: k, pair: p });
    review.sleeves[k] = { targets: tg, ...(k === 'alt' ? { tier2_top: gtop.slice(0, 10), turnover_kept: kept } : {}), trigger: dayDec ? (first ? 'first_close' : 'weekly') : 'regime_turn_on' };
  }
  st.last_targets = { ...(st.last_targets ?? {}), ...review, sleeves: { ...(st.last_targets?.sleeves ?? {}), ...review.sleeves } };
  ev.decisions.push(review);
  return ev;
}

export function alt70Status(st) {
  const sl = st.lots.filter((l) => l.role === 'sleeve'), lt = st.lots.filter((l) => l.role === 'lt');
  const holdings = {};
  for (const l of lt) { const h = (holdings[l.pair] ??= { qty: 0, cost_usdt: 0 }); h.qty = r8(h.qty + l.qty); h.cost_usdt = r8(h.cost_usdt + l.cost); }
  const book = st.cash.active + sl.reduce((s, l) => s + l.cost, 0);
  return {
    last_processed_day: st.lastT !== null ? iso(st.lastT) : null, regime_on: st.regime_on, regimes: st.regimes, bootstrapped: st.decided, bootstrap: null,
    equity: { swing_bucket: r2(st.equity?.swing ?? st.cash.active), strategy_own: r2(st.equity?.swing_own ?? st.cash.active), total: r2(st.equity?.total ?? st.start_total) },
    open_positions: sl.map((l) => ({ pair: l.pair, sleeve: l.sleeve, qty: l.qty, entry_price: l.entryPrice, mark: st.last[l.pair] ?? null, ...(st.frozen?.[l.pair] ? { frozen: true } : {}) })),
    pending: st.pend, last_review: st.last_targets,
    ledger: { swing: r2(book), longterm: r2(st.cash.lt + lt.reduce((s, l) => s + l.cost, 0)), reserve: r2(st.cash.reserve), scalp: 0 },
    reserve: { start: st.reserve_start, balance: r2(st.cash.reserve), growth: r2(st.cash.reserve - st.reserve_start), note: 'grows only from the 10 % HWM credits; never traded' },
    longterm: { cost_usdt: r2(lt.reduce((s, l) => s + l.cost, 0)), value_usdt: r2(st.equity?.longterm_value ?? 0), cash_usdt: r2(st.cash.lt), holdings },
    counts: { trades: st.entries, rebalances: st.rebalances, closed_lots: st.nTrades },
    hwm: { active: { cum: r2(st.hwm.active.c), peak: r2(st.hwm.active.p) } }, dip: null,
    valuation: 'NET of exit slippage and fee (research engine rule)',
  };
}

export function alt70DailyRow(id, t, st, e) {
  const eq = st.equity;
  return {
    date: iso(t).slice(0, 10), variant: id, regime_on: st.regime_on, regimes: { ...st.regimes }, review: e.decisions[0] ?? null, fills: e.fills,
    positions: st.lots.filter((l) => l.role === 'sleeve').map((l) => ({ pair: l.pair, sleeve: l.sleeve, qty: l.qty, value: r2(l.qty * (st.last[l.pair] ?? l.entryPrice)) })),
    cash_swing: r2(st.cash.active), equity: { swing_bucket: r2(eq.swing), strategy_own: r2(eq.swing_own), total: r2(eq.total) },
    closed_lots: e.trades.length, rebalances: 0, lt_buys: e.ltBuys.length, reserve: r2(st.cash.reserve), lt_cash: r2(st.cash.lt),
    ...(e.guard ? { guard: e.guard } : {}), ...(e.frozen_dropped ? { frozen_dropped: e.frozen_dropped } : {}),
  };
}

/** Pairs needing the closed bar of each day still to process: BTC, held lots, pending orders (the universe is checked by the caller). */
export function alt70Needed(st) {
  return [...new Set(['BTCUSDT', ...st.lots.map((l) => l.pair), ...st.pend.map((o) => o.pair ?? st.lots.find((l) => l.id === o.id)?.pair).filter(Boolean)])];
}
