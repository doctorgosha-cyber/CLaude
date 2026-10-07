// TB-BRAIN: market-state engine (src/market-state.mjs). Offline, synthetic. Pure functions: no fs, no network, no orders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closesOf, emaSeries, realizedVol, volPercentile, drawdownFromHigh, returnOver, btcTrend, breadth, basketReturn, relativeStrength, regimeLabel, armRules, altVsBtcByRegime, marketState, DAY } from '../src/market-state.mjs';
import { regimeSeries } from '../src/strategies/regime.mjs';
import { volScale } from '../src/alt70.mjs';

const T0 = Date.UTC(2025, 0, 6); // a Monday
const N = 420;
function walk(seed, p0, vol, drift) {
  let s = seed, p = p0; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const rows = [];
  for (let i = 0; i < N; i++) { p = p * Math.exp(drift(i) + (rnd() - 0.5) * vol); rows.push([T0 + i * DAY, Math.round(p * 1e4) / 1e4, 1e6]); }
  return rows;
}
const DAILY = {
  BTCUSDT: walk(3, 50000, 0.03, (i) => (i < 300 ? 0.004 : -0.012)),
  ETHUSDT: walk(5, 3000, 0.04, (i) => (i < 300 ? 0.005 : -0.015)),
  AAAUSDT: walk(9, 10, 0.05, (i) => (i < 300 ? 0.006 : -0.02)), BBBUSDT: walk(11, 5, 0.05, (i) => (i < 300 ? 0.005 : -0.02)),
  CCCUSDT: walk(13, 2, 0.05, (i) => (i < 300 ? 0.004 : -0.02)), DDDUSDT: walk(15, 1, 0.06, (i) => (i < 300 ? 0.003 : -0.02)),
  EEEUSDT: walk(17, 3, 0.05, (i) => (i < 300 ? 0.002 : -0.02)), FFFUSDT: walk(19, 7, 0.05, (i) => (i < 300 ? 0.001 : -0.02)),
};
const PAIRS = Object.keys(DAILY);
const bars = Object.fromEntries(PAIRS.map((p) => [p, closesOf(DAILY[p])]));
const maps = Object.fromEntries(PAIRS.map((p) => [p, new Map(DAILY[p].map((r) => [r[0], r[1]]))]));
const closeAt = (p, t) => maps[p]?.get(t);
// the tier-2 slice is positions 11..40 of the universe: pad the synthetic universe with 10 dummies so the 6 alts land in tier 2
const DUMMY = Array.from({ length: 10 }, (_, k) => `D${k}USDT`);
const ctx = { closeAt: (p, t) => (p.startsWith('D') ? 1 : closeAt(p, t)), universeAt: () => ['ETHUSDT', ...DUMMY, 'AAAUSDT', 'BBBUSDT', 'CCCUSDT', 'DDDUSDT', 'EEEUSDT', 'FFFUSDT'] };
const ARMS = { 'M5-B100': { kind: 'alt70', params: { alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90, turnover_min_fresh: 2, alt_turnover: true, alt_ema_filter: null, core_pair: 'BTCUSDT' } },
  'S3-M0': { kind: 'ml2', params: { slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90 } },
  'M5-B100-TV': { kind: 'alt70', params: { alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90, turnover_min_fresh: 2, alt_turnover: true, alt_ema_filter: null, core_pair: 'BTCUSDT' }, vol_target: 0.6, vol_days: 7 } };
const tUp = T0 + 299 * DAY, tDown = T0 + (N - 1) * DAY;

test('closesOf / emaSeries / returns / drawdown / vol: definitions hold on a hand-made series', () => {
  const rows = [[T0, 10, 1], [T0 + DAY, 11, 1], [T0 + DAY, 11.5, 1], [T0 + 2 * DAY, 12, 1], [T0 + 3 * DAY, 9, 1]];
  const b = closesOf(rows);
  assert.deepEqual(b.map((x) => x.c), [10, 11.5, 12, 9], 'duplicates: last wins; ascending');
  const e = emaSeries(b, 2);
  assert.equal(e[0], null); assert.equal(e[1], (10 + 11.5) / 2);
  const k = 2 / 3; assert.ok(Math.abs(e[2] - (k * 12 + (1 - k) * e[1])) < 1e-12);
  assert.equal(returnOver(b, T0 + 3 * DAY, 3), 9 / 10 - 1);
  assert.equal(returnOver(b, T0, 3), null, 'no earlier close -> null');
  assert.equal(drawdownFromHigh(b, 90), 9 / 12 - 1);
  const rv = realizedVol(b, 3);
  const r = [Math.log(11.5 / 10), Math.log(12 / 11.5), Math.log(9 / 12)], m = r.reduce((s, x) => s + x) / 3;
  assert.ok(Math.abs(rv - Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / 2) * Math.sqrt(365)) < 1e-12);
  assert.equal(realizedVol(b, 4), null, 'needs n+1 bars');
  assert.equal(volPercentile(b, 3, 365), null, 'needs 20 readings');
});

test('btcTrend: regime states equal strategies/regime.mjs; distances and the 3-close OFF rule', () => {
  const up = btcTrend(bars.BTCUSDT, tUp), dn = btcTrend(bars.BTCUSDT, tDown);
  const ref = (t, n) => regimeSeries(bars.BTCUSDT.filter((x) => x.t <= t), { ema_n: n, off_after: 3 }).at(-1);
  assert.equal(up.regime.ema200.on, ref(tUp, 200).on); assert.equal(up.regime.ema100.on, ref(tUp, 100).on);
  assert.equal(dn.regime.ema200.on, ref(tDown, 200).on); assert.equal(dn.regime.ema100.on, ref(tDown, 100).on);
  assert.equal(up.regime.ema200.on, true); assert.equal(dn.regime.ema200.on, false, '120 days of -1.2 %/day: below EMA200');
  assert.ok(dn.regime.ema200.closes_below >= 3);
  assert.ok(Math.abs(up.ema.ema200.value - ref(tUp, 200).ema) < 0.01);
  assert.ok(Math.abs(up.ema.ema200.dist_pct - (up.close / ref(tUp, 200).ema - 1) * 100) < 0.01);
  assert.ok(up.dd90.pct <= 0 && dn.dd90.pct < -25, `dd90 ${dn.dd90.pct}`);
  assert.equal(up.as_of, new Date(tUp).toISOString().slice(0, 10));
  assert.ok(up.vol.rv30_ann > 0 && up.vol.pct_1y >= 0 && up.vol.pct_1y <= 100);
});

test('breadth / basketReturn / relativeStrength: counted over the given pairs only, short histories skipped', () => {
  const b = breadth(bars, PAIRS.filter((p) => p !== 'BTCUSDT'), tUp, 200);
  assert.equal(b.total, 7); assert.equal(b.above, 7); assert.equal(b.pct, 100);
  const bd = breadth(bars, PAIRS.filter((p) => p !== 'BTCUSDT'), tDown, 200);
  assert.equal(bd.above, 0);
  const short = breadth({ X: bars.AAAUSDT.slice(0, 50) }, ['X'], tUp, 200);
  assert.equal(short.total, 0); assert.equal(short.pct, null);
  const br = basketReturn(bars, ['AAAUSDT', 'BBBUSDT'], tUp, 28);
  const a = returnOver(bars.AAAUSDT, tUp, 28), c = returnOver(bars.BBBUSDT, tUp, 28);
  assert.ok(Math.abs(br.mean - (a + c) / 2) < 1e-4); assert.equal(br.n, 2);
  const rs = relativeStrength(bars, ['AAAUSDT', 'BBBUSDT'], bars.BTCUSDT, tUp, [28]);
  const btc = returnOver(bars.BTCUSDT, tUp, 28);
  assert.ok(Math.abs(rs.d28.rel_mean - ((1 + br.mean) / (1 + btc) - 1)) < 1e-3);
});

test('regimeLabel: the four labels come from the documented rules only', () => {
  assert.equal(regimeLabel({ ema200On: true, closeAboveEma50: true, breadth200Pct: 60, dd90Pct: -5, volPct1y: 30 }).label, 'risk-on');
  assert.equal(regimeLabel({ ema200On: true, closeAboveEma50: false, breadth200Pct: 60, dd90Pct: -5, volPct1y: 30 }).label, 'neutral');
  assert.equal(regimeLabel({ ema200On: true, closeAboveEma50: true, breadth200Pct: 40, dd90Pct: -5, volPct1y: 30 }).label, 'neutral');
  assert.equal(regimeLabel({ ema200On: false, closeAboveEma50: false, breadth200Pct: 10, dd90Pct: -20, volPct1y: 90 }).label, 'risk-off');
  assert.equal(regimeLabel({ ema200On: false, closeAboveEma50: false, breadth200Pct: 10, dd90Pct: -30, volPct1y: 70 }).label, 'risk-off');
  const cw = regimeLabel({ ema200On: false, closeAboveEma50: false, breadth200Pct: 10, dd90Pct: -30, volPct1y: 85 });
  assert.equal(cw.label, 'capitulation-watch'); assert.match(cw.rule, /-30 % <= -25 %/);
  assert.equal(regimeLabel({ ema200On: true, closeAboveEma50: true, breadth200Pct: null, dd90Pct: 0, volPct1y: null }).label, 'risk-on', 'missing breadth does not block');
});

test('armRules: regime on -> tier-2 top-5 and BTC core; regime off -> cash; TV overlay scale = min(1, target / basket vol)', () => {
  const on = armRules(ctx, tUp, bars.BTCUSDT, ARMS);
  assert.equal(on['M5-B100'].targets.length, 5);
  assert.deepEqual(on['M5-B100'].target_weights, { alt: 0.7, core: 0.3 }); assert.equal(on['M5-B100'].cash_weight, 0);
  assert.deepEqual(on['S3-M0'].targets, on['M5-B100'].targets, 'the alt sleeve = S3-M0 rules');
  assert.deepEqual(on['M5-B100'].core, ['BTCUSDT']);
  for (const p of on['M5-B100'].targets) assert.ok(!p.startsWith('D') && p !== 'ETHUSDT', 'dummies (rank 0.5, no 90-day change) never beat the trending alts; ETH excluded');
  const tv = on['M5-B100-TV'].tv_overlay;
  const ref = volScale({ closeAt: ctx.closeAt, pairs: [...on['M5-B100-TV'].targets, 'BTCUSDT'], t: tUp, days: 7, target: 0.6 });
  assert.equal(tv.scale, ref.scale); assert.ok(tv.scale > 0 && tv.scale <= 1);
  assert.ok(Math.abs(tv.effective_weights.alt - 0.7 * tv.scale) < 1e-3);
  const off = armRules(ctx, tDown, bars.BTCUSDT, ARMS);
  assert.deepEqual(off['M5-B100'].targets, []); assert.deepEqual(off['M5-B100'].core, []); assert.equal(off['M5-B100'].cash_weight, 1);
  assert.deepEqual(off['S3-M0'].targets, []); assert.match(off['S3-M0'].says, /cash/);
  assert.equal(off['M5-B100-TV'].tv_overlay.scale, 1, 'nothing held: no sizing');
});

test('volScale: exact formula, skips short series, 1 without usable pairs or target', () => {
  const c = (p, t) => (p === 'X' ? 100 * Math.exp(0.1 * Math.round((t - T0) / DAY) % 2 === 0 ? 0 : 0.1) : undefined);
  const r = volScale({ closeAt: (p, t) => (p === 'X' ? (Math.round((t - T0) / DAY) % 2 ? 110 : 100) : undefined), pairs: ['X', 'Y'], t: T0 + 20 * DAY, days: 4, target: 0.6 });
  const lr = [Math.log(110 / 100), Math.log(100 / 110), Math.log(110 / 100), Math.log(100 / 110)].reverse();
  const m = lr.reduce((s, x) => s + x) / 4, sd = Math.sqrt(lr.reduce((s, x) => s + (x - m) ** 2, 0) / 3) * Math.sqrt(365);
  assert.equal(r.n, 1); assert.ok(Math.abs(r.scale - Math.min(1, 0.6 / sd)) < 1e-9);
  assert.deepEqual(volScale({ closeAt: () => undefined, pairs: ['Y'], t: T0, days: 7, target: 0.6 }), { scale: 1, basket_vol: null, n: 0 });
  assert.equal(volScale({ closeAt: c, pairs: ['X'], t: T0 + 20 * DAY, days: 4, target: null }).scale, 1);
});

test('altVsBtcByRegime: Mondays only, split by regime, forward returns computed from closes (no lookahead into the stats of the past)', () => {
  const ev = altVsBtcByRegime(ctx, bars.BTCUSDT, tDown, { from: T0 + 200 * DAY, horizon: 28 });
  assert.ok(ev.weeks > 10);
  assert.equal(ev.regime_on.weeks + ev.regime_off.weeks, ev.weeks);
  assert.ok(ev.regime_off.weeks > 0 && ev.regime_on.weeks > 0);
  assert.ok(ev.regime_off.alt_median < 0, 'the synthetic bear: alts fall when the regime is off');
  assert.ok(ev.btc_drop.all.weeks > 0 && ev.btc_drop.all.btc_median <= -0.05);
  // the same call with a longer history changes nothing for the weeks already covered
  const ev2 = altVsBtcByRegime(ctx, bars.BTCUSDT, tDown - 28 * DAY, { from: T0 + 200 * DAY, horizon: 28 });
  assert.ok(ev2.weeks < ev.weeks);
});

test('marketState: snapshot carries definitions, the regime label, the arms and the evidence block; input untouched', () => {
  const before = JSON.stringify(DAILY);
  const s = marketState({ daily: DAILY, ctx, arms: ARMS, t: tUp, historyFrom: T0 + 200 * DAY });
  assert.equal(JSON.stringify(DAILY), before);
  assert.equal(s.as_of, new Date(tUp).toISOString().slice(0, 10));
  assert.equal(s.regime.label, 'risk-on'); assert.match(s.regime.rule, /EMA200 regime ON/);
  assert.ok(s.defs.ema && s.defs.regime_ema200 && s.defs.breadth && s.defs.alt_vs_btc);
  assert.ok(s.breadth.eligible_universe.ema200.total >= 6);
  assert.ok(s.alt_vs_btc.d28.rel_mean !== null && s.alt_vs_btc.tier2_pairs.length === 6);
  assert.ok(s.arms['M5-B100'].targets.length === 5 && s.arms['M5-B100-TV'].tv_overlay);
  assert.ok(s.evidence_alts_when_btc_falls.weeks > 0);
  const d = marketState({ daily: DAILY, ctx, arms: ARMS, t: tDown, historyFrom: T0 + 200 * DAY });
  assert.ok(['risk-off', 'capitulation-watch'].includes(d.regime.label));
  assert.throws(() => marketState({ daily: { X: DAILY.AAAUSDT }, ctx, arms: {} }), /BTCUSDT/);
});
