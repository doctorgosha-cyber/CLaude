#!/usr/bin/env node
// TB-DIP: preregistered "buy the dip" rules for the 300 USDT reserve (PAPER research; no network, no keys, no orders).
//   node tb-dip/run.mjs dev      [--root=.]   -> DEV phase on data truncated at 2025-10-03 (walk-forward, DSR, selection)
//   node tb-dip/run.mjs holdout  [--root=.]   -> HOLDOUT, once: needs prereg-lock.json == sha256(PREREG.md) and dev-summary.json
// --root = the NEXUS folder that holds projects/trading-bot (data/daily, src/data.mjs, config/assets.json). Zero dependencies.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const [phase, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const ROOT = resolve(flags.root ?? '.');
const BOT = join(ROOT, 'projects', 'trading-bot');
const { volumeRanks, indexDaily, isLeveragedBase } = await import(pathToFileURL(join(BOT, 'src', 'data.mjs')).href);
const OUT = join(HERE, 'tables'); mkdirSync(OUT, { recursive: true });

const DAY = 86_400_000;
const D = (s) => Date.parse(`${s}T00:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const DEV_END = D('2025-10-03'), HO_START = D('2025-10-04'), HO_END = D('2026-10-03');
const FEE = 0.001, SLIP = 0.0005, RESERVE = 300, SEED = 20261007, BOOT = 10000;

// ---------------- data ----------------
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
function loadAll(endMs) {
  const dir = join(BOT, 'data', 'daily'); const raw = {};
  for (const f of readdirSync(dir)) if (f.endsWith('USDT.json')) { const rows = readJson(join(dir, f)).filter((r) => r[0] <= endMs); if (rows.length) raw[f.slice(0, -5)] = rows; }
  return raw;
}
function btcSeries(raw) {
  const rows = raw.BTCUSDT; const t = rows.map((r) => r[0]), c = rows.map((r) => +r[1]), v = rows.map((r) => +r[2]);
  for (let i = 1; i < t.length; i++) if (t[i] - t[i - 1] !== DAY) throw new Error(`BTC gap at ${iso(t[i])}`);
  const n = c.length, ema = Array(n).fill(null), rsi = Array(n).fill(null), hi90 = Array(n).fill(null), hi180 = Array(n).fill(null), lr = Array(n).fill(null), sig = Array(n).fill(null), vz = Array(n).fill(null);
  let s = 0; const a = 2 / 201;
  for (let i = 0; i < n; i++) { if (i < 200) { s += c[i]; if (i === 199) ema[i] = s / 200; } else ema[i] = a * c[i] + (1 - a) * ema[i - 1]; }
  for (let i = 14; i < n; i++) { let up = 0, dn = 0; for (let k = i - 13; k <= i; k++) { const d = c[k] - c[k - 1]; if (d > 0) up += d; else dn -= d; } rsi[i] = dn === 0 ? 100 : 100 - 100 / (1 + up / dn); }
  for (let i = 0; i < n; i++) { if (i >= 89) hi90[i] = Math.max(...c.slice(i - 89, i + 1)); if (i >= 179) hi180[i] = Math.max(...c.slice(i - 179, i + 1)); if (i >= 1) lr[i] = Math.log(c[i] / c[i - 1]); }
  const sd = (xs) => { const m = xs.reduce((p, x) => p + x, 0) / xs.length; return Math.sqrt(xs.reduce((p, x) => p + (x - m) ** 2, 0) / (xs.length - 1)); };
  for (let i = 91; i < n; i++) sig[i] = sd(lr.slice(i - 90, i));
  const lv = v.map((x) => Math.log(Math.max(x, 1)));
  for (let i = 30; i < n; i++) { const w = lv.slice(i - 30, i); const m = w.reduce((p, x) => p + x, 0) / 30; const s2 = sd(w); vz[i] = s2 > 0 ? (lv[i] - m) / s2 : null; }
  return { t, c, v, ema, rsi, hi90, hi180, lr, sig, vz, at: new Map(t.map((x, i) => [x, i])) };
}

// ---------------- tier-2 basket (version B) ----------------
function basketCtx(raw) {
  const meta = new Map(readJson(join(BOT, 'config', 'assets.json')).assets.map((a) => [a.symbol, a]));
  const first = existsSync(join(BOT, 'data', 'daily', '_first.json')) ? readJson(join(BOT, 'data', 'daily', '_first.json')) : {};
  const idx = {}, close = {};
  for (const [p, rows] of Object.entries(raw)) { idx[p] = indexDaily(rows); close[p] = new Map(rows.map((r) => [r[0], +r[1]])); }
  const lastT = Object.fromEntries(Object.entries(raw).map(([p, r]) => [p, r[r.length - 1][0]]));
  const pegged = (m) => !!m && (m.isStablecoin || (m.tags ?? []).some((x) => ['stablecoin', 'fiat', 'gold-backed'].includes(String(x).toLowerCase())));
  const excluded = new Set(Object.keys(raw).filter((p) => { const b = p.slice(0, -4), m = meta.get(b); return pegged(m) || isLeveragedBase(b) || m?.isLeveraged || (m?.tags ?? []).includes('meme'); }));
  const cache = new Map();
  function basketAt(t) {
    if (cache.has(t)) return cache.get(t);
    const ranks = volumeRanks(idx, t + DAY, { windowDays: 90, exclude: [...excluded], excludeStableLike: true }); // window = the 90 days up to and incl. t
    const firstMs = (p) => first[p] ?? raw[p][0][0];
    const ordered = Object.keys(ranks).filter((p) => p !== 'BTCUSDT' && close[p].has(t) && t - firstMs(p) >= 365 * DAY).sort((a, b) => ranks[a] - ranks[b]).slice(0, 40);
    const b = ordered.slice(10).filter((p) => p !== 'ETHUSDT');
    cache.set(t, b); return b;
  }
  // mark: last close on or before t (a pair that stopped trading keeps its last close: survivorship bias, reported)
  const priceAt = (p, t) => { for (let d = t, k = 0; k < 4000; d -= DAY, k++) { const x = close[p].get(d); if (x !== undefined) return x; } return 0; };
  return { basketAt, priceAt, has: (p, t) => close[p].has(t), lastT };
}

// ---------------- variants ----------------
function variants() {
  const out = [];
  for (const exit of ['NONE', 'EMA']) {
    for (const L of [90, 180]) for (const X of [15, 25, 35]) for (const sz of ['ALL', 'TR3']) out.push({ id: `F1-L${L}-X${X}-${sz}-${exit}`, fam: 'F1', L, X, sz, exit });
    for (const Y of [0, 10, 20]) out.push({ id: `F2-Y${Y}-${exit}`, fam: 'F2', Y, exit });
    for (const Z of [3, 4]) out.push({ id: `F3-Z${Z}-${exit}`, fam: 'F3', Z, exit });
    for (const n of [8, 16]) out.push({ id: `F4-DCA${n}-${exit}`, fam: 'F4', n, exit });
  }
  return out;
}

// ---------------- simulation of one episode ----------------
// v = variant or {fam:'DAY1'} / {fam:'CASH'}; s,e = day ms (decision at s close; last mark at e close)
function simulate(v, s, e, B, version, BK) {
  const iS = B.at.get(s), iE = B.at.get(e); if (iS === undefined || iE === undefined || iE <= iS) return null;
  let cash = RESERVE; const hold = new Map(); // pair -> qty
  let armed = true, fired = new Set(), dca = null, pending = [], buys = 0, firstFill = null, peak = RESERVE, mdd = 0;
  const val = (t) => cash + [...hold].reduce((p, [pr, q]) => p + q * (pr === 'BTCUSDT' ? B.c[B.at.get(t)] : BK.priceAt(pr, t)), 0);
  const buy = (amt, t, pairs) => {
    amt = Math.min(amt, cash); if (amt < 1) return;
    const live = pairs.filter((p) => (p === 'BTCUSDT' ? true : BK.has(p, t))); if (!live.length) return;
    const each = amt / live.length;
    for (const p of live) { const px = p === 'BTCUSDT' ? B.c[B.at.get(t)] : BK.priceAt(p, t); const q = (each / (1 + FEE)) / (px * (1 + SLIP)); hold.set(p, (hold.get(p) ?? 0) + q); }
    cash -= amt; buys++; if (firstFill === null) firstFill = t;
  };
  const sellAll = (t) => { for (const [p, q] of hold) { const px = p === 'BTCUSDT' ? B.c[B.at.get(t)] : BK.priceAt(p, t); cash += q * px * (1 - SLIP) * (1 - FEE); } hold.clear(); };
  const target = (t) => (version === 'A' ? ['BTCUSDT'] : BK.basketAt(t));
  for (let i = iS; i <= iE; i++) {
    const t = B.t[i];
    for (const o of pending) { if (o.type === 'SELL') sellAll(t); else buy(o.amt === 'ALL' ? cash : o.amt, t, o.pairs); }
    pending = [];
    const V = val(t); peak = Math.max(peak, V); mdd = Math.max(mdd, 1 - V / peak);
    if (i === iE) break;
    const holding = hold.size > 0;
    if (v.fam === 'CASH') continue;
    if (v.fam === 'DAY1') { if (i === iS) pending.push({ amt: 'ALL', pairs: target(t) }); continue; }
    if (v.exit === 'EMA' && holding && B.ema[i] && B.c[i] >= 1.1 * B.ema[i]) { pending.push({ type: 'SELL' }); armed = true; fired = new Set(); dca = null; continue; }
    if (!armed && !(v.fam === 'F1' && v.sz === 'TR3')) continue;
    if (v.fam === 'F1') {
      const hi = v.L === 90 ? B.hi90[i] : B.hi180[i]; if (!hi) continue; const dd = (B.c[i] / hi - 1) * 100;
      if (v.sz === 'ALL') { if (dd <= -v.X) { pending.push({ amt: 'ALL', pairs: target(t) }); armed = false; } }
      else for (const thr of [v.X, v.X + 10, v.X + 20]) if (!fired.has(thr) && dd <= -thr) { fired.add(thr); pending.push({ amt: RESERVE / 3, pairs: target(t) }); }
    } else if (v.fam === 'F2') {
      if (B.ema[i] && B.rsi[i] !== null && B.c[i] <= B.ema[i] * (1 - v.Y / 100) && B.rsi[i] < 30) { pending.push({ amt: 'ALL', pairs: target(t) }); armed = false; }
    } else if (v.fam === 'F3') {
      if (B.sig[i] && B.vz[i] !== null && B.lr[i] <= -v.Z * B.sig[i] && B.vz[i] >= 2) { pending.push({ amt: 'ALL', pairs: target(t) }); armed = false; }
    } else if (v.fam === 'F4') {
      if (!dca && B.ema[i] && B.c[i] < B.ema[i]) dca = { next: i, left: v.n, slice: cash / v.n };
      if (dca && dca.left > 0 && i === dca.next) { pending.push({ amt: dca.slice, pairs: target(t) }); dca.left--; dca.next = i + 7; if (dca.left === 0) armed = false; }
    }
  }
  const final = val(e);
  return { final, buys, days_to_fill: firstFill === null ? null : (firstFill - s) / DAY, mdd, held: [...hold.keys()] };
}

// ---------------- stats ----------------
const mean = (xs) => xs.reduce((p, x) => p + x, 0) / xs.length;
const sdv = (xs) => { const m = mean(xs); return Math.sqrt(xs.reduce((p, x) => p + (x - m) ** 2, 0) / (xs.length - 1)); };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
function rng(seed) { let x = seed >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function blockBoot(xs, b, seed = SEED, n = BOOT) {
  const r = rng(seed), N = xs.length, ms = []; b = Math.min(b, N);
  for (let k = 0; k < n; k++) { const s = []; while (s.length < N) { const st = Math.floor(r() * (N - b + 1)); for (let j = 0; j < b && s.length < N; j++) s.push(xs[st + j]); } ms.push(mean(s)); }
  ms.sort((a, b2) => a - b2); return { lo: ms[Math.floor(0.025 * n)], hi: ms[Math.floor(0.975 * n) - 1] };
}
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function PhiInv(p) { // Acklam
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const q = p < 0.02425 ? Math.sqrt(-2 * Math.log(p)) : p > 1 - 0.02425 ? Math.sqrt(-2 * Math.log(1 - p)) : null;
  if (q !== null && p < 0.5) return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (q !== null) return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  const u = p - 0.5, r = u * u; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * u / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function dsr(xs, N, varSR, Teff) {
  const SR = mean(xs) / sdv(xs), m = mean(xs), s = sdv(xs);
  const sk = mean(xs.map((x) => ((x - m) / s) ** 3)), ku = mean(xs.map((x) => ((x - m) / s) ** 4));
  const g = 0.5772156649, SR0 = Math.sqrt(varSR) * ((1 - g) * PhiInv(1 - 1 / N) + g * PhiInv(1 - 1 / (N * Math.E)));
  const den = Math.sqrt(Math.max(1e-9, 1 - sk * SR + ((ku - 1) / 4) * SR * SR));
  return { SR: +SR.toFixed(4), SR0: +SR0.toFixed(4), skew: +sk.toFixed(3), kurt: +ku.toFixed(3), Teff: +Teff.toFixed(2), N, DSR: +Phi(((SR - SR0) * Math.sqrt(Math.max(Teff - 1, 0))) / den).toFixed(4) };
}

// ---------------- episodes ----------------
function monthStarts(fromS, toS) { const out = []; const d = new Date(`${fromS}T00:00:00Z`); while (d.getTime() <= D(toS)) { out.push(d.getTime()); d.setUTCMonth(d.getUTCMonth() + 1); } return out; }
function runEpisodes(VS, starts, endOf, B, version, BK) {
  const rows = {};
  for (const s of starts) {
    const e = endOf(s); if (e - s < 2 * DAY) continue;
    const cash = simulate({ fam: 'CASH' }, s, e, B, version, BK), d1 = simulate({ fam: 'DAY1' }, s, e, B, version, BK);
    for (const v of VS) {
      const r = simulate(v, s, e, B, version, BK);
      (rows[v.id] ??= []).push({ s: iso(s), e: iso(e), final: r.final, xs_cash: ((r.final - cash.final) / RESERVE) * 100, xs_day1: ((r.final - d1.final) / RESERVE) * 100, day1: d1.final, deployed: r.buys > 0, days_to_fill: r.days_to_fill, buys: r.buys, mdd: r.mdd });
    }
  }
  return rows;
}
const summarize = (id, eps) => ({ id, n: eps.length, mean_final: +mean(eps.map((x) => x.final)).toFixed(2), xs_cash: +mean(eps.map((x) => x.xs_cash)).toFixed(2), xs_day1: +mean(eps.map((x) => x.xs_day1)).toFixed(2),
  deployed_pct: Math.round((eps.filter((x) => x.deployed).length / eps.length) * 100), med_days_to_fill: median(eps.filter((x) => x.deployed).map((x) => x.days_to_fill)), mean_buys: +mean(eps.map((x) => x.buys)).toFixed(2), mean_mdd_pct: +(mean(eps.map((x) => x.mdd)) * 100).toFixed(1) });
function select(rows) { // highest mean xs_day1 among variants with mean xs_cash >= 0; null = "no rule" (cash)
  let best = null;
  for (const [id, eps] of Object.entries(rows)) { if (!eps.length) continue; const xc = mean(eps.map((x) => x.xs_cash)), xd = mean(eps.map((x) => x.xs_day1)); if (xc >= 0 && (!best || xd > best.xd)) best = { id, xd, xc }; }
  return best;
}
function longPath(v, s, e, B, version, BK) { const r = simulate(v, s, e, B, version, BK); const yrs = (e - s) / DAY / 365; return { final: +r.final.toFixed(2), cagr_pct: +((Math.pow(r.final / RESERVE, 1 / yrs) - 1) * 100).toFixed(2), mdd_pct: +(r.mdd * 100).toFixed(1), buys: r.buys, first_fill: r.days_to_fill === null ? null : iso(s + r.days_to_fill * DAY) }; }
const csv = (rowsArr) => { const k = Object.keys(rowsArr[0]); return [k.join(','), ...rowsArr.map((r) => k.map((x) => r[x] ?? '').join(','))].join('\n') + '\n'; };
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// ---------------- phases ----------------
const VS = variants();
if (phase === 'dev') {
  const raw = loadAll(DEV_END); const B = btcSeries(raw); const BK = basketCtx(raw);
  const starts = monthStarts('2021-01-01', '2025-09-01');
  const summary = { phase: 'dev', data_end: iso(DEV_END), variants: VS.length, trials_total: VS.length * 2, versions: {} };
  const allSR = {};
  const perVersion = {};
  for (const ver of ['A', 'B']) {
    const rows = runEpisodes(VS, starts, (s) => Math.min(s + 365 * DAY, DEV_END), B, ver, BK);
    perVersion[ver] = rows;
    const tab = VS.map((v) => summarize(v.id, rows[v.id]));
    writeFileSync(join(OUT, `dev-variants-${ver}.csv`), csv(tab));
    for (const v of VS) { const xs = rows[v.id].map((x) => x.xs_day1); allSR[`${ver}:${v.id}`] = mean(xs) / sdv(xs); }
    // walk-forward (anchored)
    const folds = [['2022-01-01', '2022-12-01'], ['2023-01-01', '2023-12-01'], ['2024-01-01', '2024-12-01'], ['2025-01-01', '2025-09-01']];
    const wf = []; const oos = [];
    for (const [a, b] of folds) {
      const fs = D(a), trainStarts = starts.filter((s) => s < fs);
      const tr = runEpisodes(VS, trainStarts, (s) => Math.min(s + 365 * DAY, fs - DAY), B, ver, BK);
      const sel = select(tr);
      const testStarts = starts.filter((s) => s >= fs && s <= D(b));
      const te = sel ? rows[sel.id].filter((x) => D(x.s) >= fs && D(x.s) <= D(b)) : testStarts.map((s) => { const c = rows[VS[0].id].find((x) => x.s === iso(s)); return { s: iso(s), xs_cash: 0, xs_day1: ((RESERVE - c.day1) / RESERVE) * 100 }; });
      oos.push(...te);
      wf.push({ fold: `${a}..${b}`, selected: sel?.id ?? 'CASH (no variant with xs_cash >= 0)', train_xs_day1: sel ? +sel.xd.toFixed(2) : null, test_n: te.length, test_xs_cash: +mean(te.map((x) => x.xs_cash)).toFixed(2), test_xs_day1: +mean(te.map((x) => x.xs_day1)).toFixed(2) });
    }
    const sel = select(rows);
    summary.versions[ver] = {
      walkforward: wf,
      walkforward_oos: { n: oos.length, xs_cash: +mean(oos.map((x) => x.xs_cash)).toFixed(2), xs_day1: +mean(oos.map((x) => x.xs_day1)).toFixed(2), ci_cash: blockBoot(oos.map((x) => x.xs_cash), 6), ci_day1: blockBoot(oos.map((x) => x.xs_day1), 6) },
      selected: sel ? { id: sel.id, dev_xs_day1: +sel.xd.toFixed(2), dev_xs_cash: +sel.xc.toFixed(2) } : null,
      benchmarks_dev: { day1_mean_final: +mean(rows[VS[0].id].map((x) => x.day1)).toFixed(2) },
      long_path_dev: Object.fromEntries([['DAY1', { fam: 'DAY1' }], ...(sel ? [[sel.id, VS.find((v) => v.id === sel.id)]] : [])].map(([k, v]) => [k, longPath(v, D('2021-01-01'), DEV_END, B, ver, BK)])),
    };
  }
  const vals = Object.values(allSR), mSR = mean(vals), varSR = vals.reduce((p, x) => p + (x - mSR) ** 2, 0) / (vals.length - 1);
  for (const ver of ['A', 'B']) { const sel = summary.versions[ver].selected; if (sel) { const xs = perVersion[ver][sel.id].map((x) => x.xs_day1); summary.versions[ver].dsr = dsr(xs, VS.length * 2, varSR, (xs.length * 30.44) / 365); } }
  summary.var_sr_across_trials = +varSR.toFixed(5);
  writeFileSync(join(HERE, 'dev-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} else if (phase === 'holdout') {
  const lock = readJson(join(HERE, 'prereg-lock.json'));
  if (sha(join(HERE, 'PREREG.md')) !== lock.sha256) { console.error('refused: PREREG.md changed after the lock'); process.exit(2); }
  if (!existsSync(join(HERE, 'dev-summary.json'))) { console.error('refused: run the dev phase first'); process.exit(2); }
  if (existsSync(join(HERE, 'holdout-results.json')) && !flags.force) { console.error('refused: holdout already evaluated once (holdout-results.json exists)'); process.exit(2); }
  const dev = readJson(join(HERE, 'dev-summary.json'));
  const raw = loadAll(HO_END); const B = btcSeries(raw); const BK = basketCtx(raw);
  const starts = [HO_START, ...monthStarts('2025-11-01', '2026-09-01')];
  const res = { phase: 'holdout', prereg_sha256: lock.sha256, dev_summary_sha256: sha(join(HERE, 'dev-summary.json')), window: `${iso(HO_START)}..${iso(HO_END)}`, versions: {} };
  for (const ver of ['A', 'B']) {
    const rows = runEpisodes(VS, starts, () => HO_END, B, ver, BK);
    writeFileSync(join(OUT, `holdout-variants-${ver}.csv`), csv(VS.map((v) => summarize(v.id, rows[v.id]))));
    const selId = dev.versions[ver].selected?.id ?? null;
    const d = dev.versions[ver];
    const out = { selected: selId, decisive: true };
    if (selId) {
      const eps = rows[selId];
      writeFileSync(join(OUT, `holdout-episodes-${ver}.csv`), csv(eps.map(({ s, e, final, day1, xs_cash, xs_day1, buys, days_to_fill }) => ({ s, e, final: final.toFixed(2), day1: day1.toFixed(2), xs_cash: xs_cash.toFixed(2), xs_day1: xs_day1.toFixed(2), buys, days_to_fill }))));
      out.summary = summarize(selId, eps);
      out.ci_cash = blockBoot(eps.map((x) => x.xs_cash), 3); out.ci_day1 = blockBoot(eps.map((x) => x.xs_day1), 3);
      out.long_path = { [selId]: longPath(VS.find((v) => v.id === selId), HO_START, HO_END, B, ver, BK), DAY1: longPath({ fam: 'DAY1' }, HO_START, HO_END, B, ver, BK) };
      const p1 = d.walkforward_oos.xs_day1 > 0 && d.walkforward_oos.xs_cash > 0;
      const p2 = out.summary.xs_day1 > 0 && out.summary.xs_cash > 0 && out.ci_day1.lo > 0 && out.ci_cash.lo > 0;
      const p3 = (d.dsr?.DSR ?? 0) >= 0.95;
      out.pass = { walkforward: p1, holdout: p2, dsr: p3, ALL: p1 && p2 && p3 };
    } else out.pass = { ALL: false, note: 'dev selection was "no rule" (cash)' };
    if (ver === 'B') { const held = new Set(); for (const s of starts) for (const p of BK.basketAt(s)) held.add(p); out.basket_pairs_seen = held.size; out.basket_pairs_stopped_before_end = [...held].filter((p) => BK.lastT[p] < HO_END - 2 * DAY); }
    res.versions[ver] = out;
  }
  writeFileSync(join(HERE, 'holdout-results.json'), JSON.stringify(res, null, 2) + '\n');
  console.log(JSON.stringify(res, null, 2));
} else { console.error('usage: node tb-dip/run.mjs dev|holdout [--root=<folder with projects/trading-bot>]'); process.exit(2); }
