// TB-BRAIN: M5-B100-TV proposal (target-vol overlay on the alt70 day step). OFF by default; live arms untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveVariant, resolveVariants, variantFingerprint, variantCapital, M5_B100_TV_PROPOSAL, ALT70_PARAM_DEFAULTS } from '../src/variants.mjs';
import { createAlt70State, alt70Day, volScale } from '../src/alt70.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config0 = JSON.parse(readFileSync(join(ROOT, 'config/bot.config.json'), 'utf8'));
const config = { ...config0, capital: variantCapital(config0) };
const DAY = 864e5, T0 = Date.UTC(2025, 0, 6);
const ALTS = ['AAAUSDT', 'BBBUSDT', 'CCCUSDT', 'DDDUSDT', 'EEEUSDT', 'FFFUSDT'];
const G = { AAAUSDT: 0.004, BBBUSDT: 0.0035, CCCUSDT: 0.003, DDDUSDT: 0.0025, EEEUSDT: 0.002, FFFUSDT: 0.0015 };

test('M5-B100-TV: proposal resolves with vol_target / vol_days; not in config.forward.variants (OFF by default); strict validation', () => {
  assert.ok(!config0.forward.variants.some((v) => v.id === 'M5-B100-TV'), 'OFF by default: NEXUS installs it via tb-safe-install');
  const v = resolveVariant(config0, M5_B100_TV_PROPOSAL);
  assert.equal(v.strategy, 'alt70'); assert.equal(v.alt70.vol_target, 0.6); assert.equal(v.alt70.vol_days, 7);
  assert.equal(v.params.vol_target, 0.6); assert.equal(v.params.vol_days, 7);
  const { vol_target, vol_days, ...rest } = v.params;
  assert.deepEqual(rest, { ...ALT70_PARAM_DEFAULTS, universe: {} }, 'everything else = M5-B100');
  assert.throws(() => resolveVariant(config0, { id: 'Z', strategy: 'alt70', params: { vol_target: 0 } }), /vol_target/);
  assert.throws(() => resolveVariant(config0, { id: 'Z', strategy: 'alt70', params: { vol_target: 0.6, vol_days: 1 } }), /vol_days/);
  assert.throws(() => resolveVariant(config0, { id: 'Z', strategy: 'alt70', params: { vol_tgt: 0.6 } }), /unknown param/);
  const all = resolveVariants(config0);
  const fp = (id) => JSON.stringify(variantFingerprint(config, all.find((x) => x.id === id)));
  assert.notEqual(fp('M5-B100'), JSON.stringify(variantFingerprint(config, v)), 'the proposal has its own fingerprint');
});

test('live M5-B100 and C8 are byte-identical: params, alt70 block and fingerprints unchanged (no exit 4)', () => {
  const V = Object.fromEntries(resolveVariants(config0).map((v) => [v.id, v]));
  const base = { alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, exclude: ['ETHUSDT'], lookback_days: 90, turnover_min_fresh: 2, core_pair: 'BTCUSDT', lt_min_buy_usdt: 10 };
  assert.deepEqual(V['M5-B100'].alt70, { ...base, alt_turnover: true, alt_ema_filter: null });
  assert.deepEqual(V.C8.alt70, { ...base, alt_turnover: false, alt_ema_filter: 50 });
  assert.ok(!('vol_target' in V['M5-B100'].params) && !('vol_target' in V.C8.params));
  for (const id of ['M5-B100', 'C8']) {
    const f = join(ROOT, 'state', id, 'paper-state.json');
    try {
      const saved = JSON.parse(readFileSync(f, 'utf8'));
      const legacy = !('bootstrap_review' in saved.fingerprint); // as test/alt70.test.mjs
      const fp = legacy ? variantFingerprint(config, V[id]) : { ...variantFingerprint(config, V[id]), bootstrap_review: config0.forward.bootstrap_review === true };
      assert.equal(JSON.stringify(fp), JSON.stringify(saved.fingerprint), `${id}: live fingerprint`);
    }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
});

function market(volMul) {
  // alts with a deterministic zig-zag so the 7-day vol is known; BTC flat up
  const close = (p, d) => (p === 'BTCUSDT' ? 100 * 1.001 ** d : 10 * (1 + G[p]) ** d * (1 + volMul * (d % 2 ? 0.05 : -0.05)));
  const bar = (p, t) => { const d = Math.round((t - T0) / DAY); if (d < 0 || d > 400 || !(p === 'BTCUSDT' || G[p])) return undefined; const c = close(p, d); return { t, o: d ? close(p, d - 1) : c, h: c, l: c, c }; };
  return { bar, closeAt: (p, t) => bar(p, t)?.c };
}
function ctxOf(params, volMul) {
  const m = market(volMul);
  return { config, params: { ...params, tier_from: 0 }, bar: m.bar, closeAt: m.closeAt, emaAt: () => NaN, universeAt: () => ALTS, ltAt: () => [], ranksAt: () => ({}),
    market: () => ({ stepSize: 1e-6, minNotional: 5 }), regimes: { alt: () => true, core: () => true }, guard: null, decide: true };
}
function run(params, volMul, from = 100, to = 103) {
  const ctx = ctxOf(params, volMul);
  const st = createAlt70State(config); st.lastT = T0 + (from - 1) * DAY;
  const evs = {};
  for (let d = from; d <= to; d++) evs[d] = alt70Day(st, T0 + d * DAY, ctx);
  return { st, evs, ctx };
}

test('TV overlay: buys are scaled by min(1, target / 7-day basket vol) at the fill; without vol_target the fills equal M5-B100', () => {
  const V = Object.fromEntries(resolveVariants(config0).map((v) => [v.id, v]));
  const tv = resolveVariant(config0, M5_B100_TV_PROPOSAL).alt70;
  const base = run(V['M5-B100'].alt70, 1), over = run(tv, 1);
  const fills = (r) => Object.values(r.evs).flatMap((e) => e.fills);
  const fb = fills(base), fo = fills(over);
  assert.equal(fb.length, 6, 'top-5 alts + BTC core'); assert.equal(fo.length, 6);
  const e = Object.values(over.evs).find((x) => x.tv && x.tv.pairs.length); // the fill day (pending buys from the first close)
  assert.ok(e && e.tv.scale > 0 && e.tv.scale < 1, `scale ${e?.tv?.scale}`);
  const ref = volScale({ closeAt: over.ctx.closeAt, pairs: e.tv.pairs, t: e.tv.time ? Date.parse(e.tv.time) - DAY : 0, days: 7, target: 0.6 });
  assert.equal(e.tv.scale, ref.scale, 'scale computed from the decision close (t - 1 day)');
  for (const f of fo) { const b = fb.find((x) => x.pair === f.pair); assert.ok(Math.abs(f.cost - b.cost * e.tv.scale) < 0.02, `${f.pair}: ${f.cost} vs ${b.cost} x ${e.tv.scale}`); }
  assert.ok(over.st.cash.active > base.st.cash.active, 'the overlay keeps cash');
  // a calm market: scale 1 -> identical fills
  const calmB = run(V['M5-B100'].alt70, 0), calmO = run(tv, 0);
  assert.deepEqual(fills(calmO).map((f) => [f.pair, f.cost]), fills(calmB).map((f) => [f.pair, f.cost]));
  assert.equal(Object.values(calmO.evs).find((x) => x.tv && x.tv.pairs.length).tv.scale, 1);
});
