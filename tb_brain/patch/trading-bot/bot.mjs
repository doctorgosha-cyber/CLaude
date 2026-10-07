#!/usr/bin/env node
// Binance Spot PAPER-trading bot with bucketed capital. Simulated fills only.
// There is deliberately no order path (live, testnet or otherwise) in this codebase.
// Network: only --paper-forward with the default source, and only through lib/public-market-data.mjs
// (public, unauthenticated market-data GETs with a host/path allowlist).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildUniverse } from './src/universe.mjs';
import { runPaper, parseKlines } from './src/paper.mjs';
import { loadWindow, loadDaily, load15m, makeUniverse, marketOf, rankPool } from './src/realdata.mjs';
import { runForwardOnce, fileSource } from './src/forward.mjs';
import { writeJsonAtomic, readJsonOr } from './src/store.mjs';
import { DAY_MS } from './src/data.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);

const USAGE = `usage: node bot.mjs --paper          [--config=path] [--out=dir] [--quiet]   synthetic fixtures, offline
       node bot.mjs --replay         [--window=id] [--out=dir] [--quiet]     real cached klines, one window (default: current)
       node bot.mjs --regimes        [--out=dir] [--quiet]                   all windows in config.real.windows
       node bot.mjs --compare        [--window=design|oos] [--oos] [--strategy=swing|regime|momentum|swing-regime|swing-wide]
                                     research comparison + pass criteria; oos refuses without a valid <project>/out/FROZEN.json
                                     and opens once (writes <project>/out/OOS-OPENED.json; a second open exits 5)
       node bot.mjs --freeze         write <project>/out/FROZEN.json (one-time, fixed path) after design work
       node bot.mjs --paper-forward  [--once] [--state=dir] [--out=dir]      forward paper (swing, 15m) on live PUBLIC klines
       node bot.mjs --paper-forward --once --variant=<id> | --all           A variants (config.forward.variants), daily bars, one pass
       node bot.mjs --paper-status   [--json]                                combined summary of swing and every variant
       node bot.mjs signals          [--out=dir] [--state=dir] [--now=<ISO>] [--asof=<YYYY-MM-DD>]
                                     TB-BRAIN: market-state snapshot + what the tested rules say -> out/signals.json, out/signals.md
                    test-only: --source=file:<dir> --now=<ISO time>          offline source, simulated clock
       node bot.mjs --live   (refused: live trading is Owner-gated)`;

if (flag('--live') || flag('--testnet')) {
  console.error(flag('--live')
    ? 'REFUSED: live trading is Owner-gated. This build contains no order path of any kind. See README "Rollout plan".'
    : 'REFUSED: testnet mode is not implemented in this build (paper only). Rollout step 2 is Owner-gated.');
  process.exit(3);
}
const mode = ['--paper', '--replay', '--regimes', '--paper-forward', '--paper-status', '--compare', '--freeze'].find(flag) ?? (args.includes('signals') || flag('--signals') ? 'signals' : undefined);
if (!mode) { console.error(USAGE); process.exit(1); }
if (flag('--oos') && mode !== '--compare') { console.error('REFUSED: --oos is only valid with --compare (and needs out/FROZEN.json)'); process.exit(5); }
const strategyOpt = opt('--strategy');
if (strategyOpt && !['swing', 'regime', 'momentum', 'swing-regime', 'swing-wide'].includes(strategyOpt)) { console.error(`unknown --strategy=${strategyOpt}`); process.exit(1); }
if (strategyOpt && strategyOpt !== 'swing' && mode !== '--compare') {
  console.error(`REFUSED: --strategy=${strategyOpt} runs only under --compare (research protocol); replay/regimes/forward use the current swing strategy until the Owner approves a change.`);
  process.exit(5);
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const config = readJson(resolve(ROOT, opt('--config') ?? 'config/bot.config.json'));
const quiet = flag('--quiet');
const say = (...a) => { if (!quiet) console.log(...a); };
const jsonl = (rows) => rows.map((t) => JSON.stringify(t)).join('\n') + (rows.length ? '\n' : '');
const r2 = (x) => Math.round(x * 100) / 100;
const outDir = () => resolve(ROOT, opt('--out') ?? 'out');
const LABEL = 'PAPER REPLAY on REAL public Binance data. Frozen parameters (not tuned to this data). Simulated fills. Not financial advice.';

if (mode === '--paper') runFixturePaper();
else if (mode === '--replay') runReplay();
else if (mode === '--regimes') runRegimes();
else if (mode === '--compare') await runCompare();
else if (mode === '--freeze') await runFreeze();
else if (mode === '--paper-status') await runStatus();
else if (mode === 'signals') await runSignals();
else if (flag('--all') || opt('--variant')) await runVariants();
else await runForward();

// ---------------------------------------------------------------- A variants (TB-FWD), daily bars
async function variantData(stateRoot) {
  const D = resolve(ROOT, config.real.data_dir);
  const G = await import('./src/guard.mjs');
  const base = readJson(join(D, 'exchangeInfo.json'));
  // TB-GUARD: live exchangeInfo statuses + the point-in-time tag list (shared by every arm, <state>/guard/)
  const guardDir = join(stateRoot, 'guard'), gp = G.guardPaths(guardDir);
  const safe = (p) => { try { return readJsonOr(p, null); } catch (e) { say(`GUARD WARNING: unreadable ${p} (${e.message})`); return null; } };
  const live = safe(gp.ex), tags = safe(gp.tags);
  const { ex, stats } = G.mergeExchangeInfo(base, live);
  const guard = config.forward?.guard?.enabled === false || (!live && !tags) ? null : G.makeGuard({ ex, tags, liveEx: !!live });
  const meta = new Map(readJson(resolve(ROOT, config.real.assets)).assets.map((a) => [a.symbol, a]));
  const { daily, first } = loadDaily(D);
  const ohlc = {};
  const od = join(D, 'daily-ohlc');
  if (existsSync(od)) for (const f of readdirSync(od).filter((x) => x.endsWith('.json'))) ohlc[f.slice(0, -5)] = readJson(join(od, f));
  return { ex, meta, daily, first, ohlc, guard, guardDir: guard ? guardDir : null, guardStats: stats };
}

async function runVariants() {
  const { resolveVariants } = await import('./src/variants.mjs');
  const FD = await import('./src/forward-daily.mjs');
  const all = resolveVariants(config);
  const want = flag('--all') ? all : all.filter((v) => v.id === opt('--variant'));
  if (!want.length) { console.error(`unknown --variant=${opt('--variant')} (configured: ${all.map((v) => v.id).join(', ') || 'none'})`); process.exit(1); }
  const stateRoot = resolve(ROOT, opt('--state') ?? config.forward.state_dir);
  const out = resolve(ROOT, opt('--out') ?? config.forward.out_dir);
  const src = opt('--source') ?? 'api';
  const now = opt('--now') ? Date.parse(opt('--now')) : Date.now();
  const log = (m) => say(`[${new Date().toISOString()}] ${m}`);
  { // TB-EPERM-1: a state write that needed a retry (OneDrive/AV file lock) is logged once in guard-log.jsonl and on stderr under --quiet
    const { storeHooks } = await import('./src/store.mjs');
    storeHooks.retryLog = join(stateRoot, 'guard', 'guard-log.jsonl');
    storeHooks.warn = (m) => (quiet ? console.error(`[${new Date().toISOString()}] ${m}`) : log(m));
  }
  let source;
  if (src.startsWith('file:')) {
    const dir = resolve(ROOT, src.slice(5));
    source = FD.fileDailySource(dir, (p) => (existsSync(p) ? readJson(p) : null), existsSync);
  } else if (src === 'api') {
    const net = await import('./lib/public-market-data.mjs');
    source = { name: 'api:data-api.binance.vision (public 1d klines)', daily: (pair, startTime, endTime) => net.fetchKlines(pair, '1d', { startTime, endTime, retries: 2, log }) };
    if (config.forward?.guard?.enabled !== false) { // TB-GUARD daily refresh (never throws; a failure keeps the last files)
      const G = await import('./src/guard.mjs');
      try {
        const glog = (m) => (quiet && m.startsWith('GUARD WARNING') ? console.error(`[${new Date().toISOString()}] ${m}`) : log(m)); // warnings reach scheduler.log
        const r = await G.refreshGuard({ dir: join(stateRoot, 'guard'), net, now, log: glog, seedPath: resolve(ROOT, config.forward?.guard?.seed ?? 'data/guard-seed/monitoring-tags.json') });
        if (r.ex !== 'cached' || r.tags !== 'cached' || r.announcements !== 'cached') log(`guard refresh: exchangeInfo ${r.ex}; tags ${r.tags}; announcements ${r.announcements}`);
      } catch (e) { log(`GUARD WARNING: refresh crashed (${e.message}); using the last files`); }
    }
  } else { console.error(`unknown --source=${src}`); process.exit(1); }
  say(`mode: PAPER-FORWARD A variants ${want.map((v) => v.id).join(', ')} (${source.name}); ${FD.LABEL}`);
  const data = await variantData(stateRoot);
  if (data.guard) say(`guard: ${data.guardStats.live ? `live exchangeInfo ${data.guardStats.fetched_at} (status changes ${data.guardStats.status_changed}, removed ${data.guardStats.removed}, new listings not in the pool ${data.guardStats.new_not_in_pool})` : 'NO live exchangeInfo snapshot (base statuses)'}`);
  const codes = [];
  for (const v of want) {
    try { codes.push((await FD.runVariantOnce({ config, variant: v, data, source, now, stateRoot, outDir: out, log })).status); }
    catch (e) {
      // fix round 1 (QA finding 9): visible under --quiet too: stderr (scheduler.log) + a runs.jsonl row -> --paper-status ESCALATION
      const msg = `ERROR ${v.id} (state not committed): ${e.stack ?? e.message}`;
      if (quiet) console.error(`[${new Date().toISOString()}] ${msg}`); else log(msg);
      try { const { appendLines } = await import('./src/store.mjs'); appendLines(FD.variantPaths(stateRoot, out, v.id).runs, [{ time: new Date(now).toISOString(), status: 'error', error: String(e.message ?? e).slice(0, 300) }]); } catch { /* never mask the original error */ }
      codes.push('error');
    }
  }
  process.exit(codes.includes('config_mismatch') ? 4 : codes.includes('error') ? 2 : 0);
}

async function runStatus() {
  const { resolveVariants } = await import('./src/variants.mjs');
  const FD = await import('./src/forward-daily.mjs');
  const stateRoot = resolve(ROOT, opt('--state') ?? config.forward.state_dir);
  const rows = [];
  const sw = readJsonOr(join(stateRoot, 'paper-state.json'), null);
  if (sw) {
    const e = sw.engine, eq = e.perf?.equity ?? {};
    rows.push({ id: 'swing', label: 'PAPER, no proven edge', last: e.lastT !== null ? new Date(e.lastT).toISOString() : null, regime: 'n/a', equity_total: eq.total, bucket: eq.swing, own: eq.swing_own,
      positions: e.positions.map((p) => p.symbol), trades: e.stats.swing.trades, ledger: e.ledger, lt_value: r2(Object.entries(e.lt.holdings).reduce((s, [p, h]) => s + h.qty * (e.lastClose[p] ?? 0), 0)) });
  } else rows.push({ id: 'swing', missing: true });
  for (const v of resolveVariants(config)) {
    const lastRun = (() => { try { const f = join(resolve(ROOT, opt('--out') ?? config.forward.out_dir), `forward-${v.id}-runs.jsonl`); const L = existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n') : []; return L.length ? JSON.parse(L.at(-1)) : null; } catch { return null; } })();
    let s, x, P, pend;
    try { // fix round 1: an unreadable state is escalated, never a status crash
      s = readJsonOr(join(stateRoot, v.id, 'paper-state.json'), null);
      if (!s) { rows.push({ id: v.id, missing: true }); continue; }
      x = FD.variantStatus(s.portfolio);
      P = s.portfolio; pend = P.kind === 'ml2' || P.kind === 'alt70' ? P.pend : P.kind === 'rel' ? [] : [...(P.pending?.sells ?? []), ...(P.dip?.pending?.sells ?? [])];
    } catch (e) { rows.push({ id: v.id, broken: String(e.message).slice(0, 160), frozen: {}, guard_sells: [], last_run: lastRun ? { time: lastRun.time, status: lastRun.status, error: lastRun.error } : null }); continue; }
    const oo = (b) => (b === null || b === undefined ? 'n/a' : b ? 'on' : 'off'); // alt70 (M5-B100 / C8): both sleeve regimes
    const regime = x.regimes ? `alt ${oo(x.regimes.alt)}/core ${oo(x.regimes.core)}` : x.regime_on === null ? 'n/a' : x.regime_on ? 'on' : 'off';
    rows.push({ id: v.id, label: 'PAPER, no proven edge', last: x.last_processed_day, regime, slots: x.slots ?? null, equity_total: x.equity.total, bucket: x.equity.swing_bucket, own: x.equity.strategy_own,
      positions: x.open_positions.map((p) => p.pair), trades: x.counts.trades, rebalances: x.counts.rebalances, bootstrapped: x.bootstrapped, reserve_growth: x.reserve.growth, dip: x.dip ? { lots: x.dip.lots.length, armed: x.dip.armed, reserve_mtm: x.dip.reserve_mtm } : null, closed_lots: x.counts.closed_lots, ledger: x.ledger, lt_value: x.longterm.value_usdt, first_trading_day: s.first_trading_day,
      frozen: x.frozen ?? {}, guard_flags: x.guard_flags ?? null, guard_sells: pend.filter((o) => String(o.reason ?? '').startsWith('guard_')).map((o) => o.pair ?? P.lots?.find((l) => l.id === o.id)?.pair ?? o.id),
      last_run: lastRun ? { time: lastRun.time, status: lastRun.status, error: lastRun.error } : null });
  }
  const G = await import('./src/guard.mjs'), gp = G.guardPaths(join(stateRoot, 'guard'));
  const gsafe = (p) => { try { return readJsonOr(p, null); } catch { return null; } };
  const gex = gsafe(gp.ex), gtags = gsafe(gp.tags), nowMs = Date.now();
  const age = (iso) => (iso ? Math.round((nowMs - Date.parse(iso)) / 3_600_000) : null);
  const guard = { exchangeInfo_fetched: gex?.fetched_at ?? null, tags_refreshed: gtags?.refreshed?.tags ?? null, announcements_refreshed: gtags?.refreshed?.announcements ?? null,
    tagged_now: gtags ? gtags.episodes.filter((e) => e.removed === null).map((e) => e.symbol).sort() : null };
  guard.stale = [guard.exchangeInfo_fetched, guard.tags_refreshed, guard.announcements_refreshed].some((t) => t === null || age(t) > 36);
  if (flag('--json')) { rows[0].guard = guard; console.log(JSON.stringify(rows, null, 2)); return; } // array kept (compat); guard summary on the first row
  console.log('PAPER STATUS (simulated fills, no orders; every arm: NO PROVEN EDGE)');
  console.log(`guard: exchangeInfo ${guard.exchangeInfo_fetched ?? 'never'} | tags ${guard.tags_refreshed ?? 'never'} | announcements ${guard.announcements_refreshed ?? 'never'} | tagged now ${guard.tagged_now ? guard.tagged_now.length : '-'}${guard.stale ? ' | WARNING: guard data missing or older than 36 h (the last list is used)' : ''}`);
  for (const r of rows) {
    if (r.missing || r.id === 'swing') continue;
    if (r.broken) console.log(`ESCALATION ${r.id}: state unreadable (${r.broken})`);
    const fz = Object.entries(r.frozen ?? {});
    if (fz.length) console.log(`ESCALATION ${r.id}: FROZEN ${fz.map(([p, f]) => `${p} (status ${f.status} since ${f.since.slice(0, 10)}, valued at last close ${f.last_close})`).join('; ')} - no orders, rest of the arm runs; Owner decision needed`);
    if (r.guard_sells.length) console.log(`ESCALATION ${r.id}: guard sell pending at the next open: ${r.guard_sells.join(', ')}`);
    if (r.guard_flags) console.log(`ESCALATION ${r.id}: longterm holding tagged/not trading (never sold, Owner rule 3): ${r.guard_flags.longterm_flagged.map((f) => `${f.pair} ${f.why}`).join(', ')}`);
    if (r.last_run && !['ok', 'idle', 'init'].includes(r.last_run.status)) console.log(`ESCALATION ${r.id}: last run ${r.last_run.time} status ${r.last_run.status}${r.last_run.error ? ` (${String(r.last_run.error).slice(0, 160)})` : ''}`);
  }
  for (const r of rows) {
    if (r.missing) { console.log(`${r.id.padEnd(6)} not initialised`); continue; }
    if (r.broken) { console.log(`${r.id.padEnd(6)} STATE UNREADABLE (see ESCALATION)`); continue; }
    const L = r.ledger;
    console.log(`${r.id.padEnd(6)} last ${r.last} | regime ${r.regime}${r.bootstrapped === false ? ' (bootstrap review pending)' : ''} | equity ${r2(r.equity_total)} (bucket ${r2(r.bucket)}, own ${r2(r.own)}) | open ${r.positions.length ? r.positions.join(',') : '-'} | trades ${r.trades}${r.rebalances !== undefined ? ` rebal ${r.rebalances}` : ''} | swing ${r2(L.swing)} longterm ${r2(L.longterm)} (holdings ${r.lt_value}) reserve ${r2(L.reserve)}${r.reserve_growth != null ? ` (+${r.reserve_growth} from 10 % credits)` : ''}${r.dip ? ` | dip lots ${r.dip.lots}, armed ${r.dip.armed.map((a) => (a ? 1 : 0)).join('')}, reserve MTM ${r.dip.reserve_mtm}` : ''}${r.slots ? ` | slots ${r.slots.length ? r.slots.map((s) => `${s.alt ?? '-'}:${s.holding}`).join(',') : '(selected at the first close)'}` : ''}`);
  }
}

// ---------------------------------------------------------------- TB-BRAIN: signals & market state (read-only, offline)
async function runSignals() {
  const { makeSignals } = await import('./src/signals.mjs');
  const out = outDir();
  const stateRoot = resolve(ROOT, opt('--state') ?? config.forward.state_dir);
  const now = opt('--now') ? Date.parse(opt('--now')) : Date.now();
  const t = opt('--asof') ? Date.parse(`${opt('--asof')}T00:00:00Z`) : null;
  const r = makeSignals({ root: ROOT, config, stateRoot, now, t });
  mkdirSync(out, { recursive: true });
  writeJsonAtomic(join(out, 'signals.json'), r.signals);
  writeJsonAtomic(join(out, 'market-state.json'), r.snapshot);
  writeFileSync(join(out, 'signals.md'), r.markdown);
  say(`mode: SIGNALS (PAPER; rule outputs on cached public daily closes; no orders)`);
  say(r.markdown);
  say(`wrote ${join(out, 'signals.json')}, market-state.json, signals.md`);
}

// ---------------------------------------------------------------- research (TB-STRATEGY-V2)
async function runCompare() {
  const R = await import('./src/research.mjs');
  const winName = flag('--oos') ? 'oos' : (opt('--window') ?? 'design');
  if (!['design', 'oos'].includes(winName)) { console.error('use --window=design|oos'); process.exit(1); }
  const out = outDir();
  const frozenPath = R.frozenPathOf(ROOT); // fixed path: --out never moves the lock
  try {
    let marker = null;
    if (winName === 'oos') {
      if (strategyOpt) { console.error('REFUSED: the OOS is opened once, for all strategies together (no --strategy)'); process.exit(5); }
      if (existsSync(R.oosMarkerOf(ROOT))) throw new Error(`OOS LOCKED: the OOS was already opened (${R.oosMarkerOf(ROOT)} exists). It can be opened only once.`);
      const f = R.verifyFrozen(ROOT, config);
      say(`OOS unlocked by ${frozenPath} (frozen ${f.frozen_at}); ${Object.keys(f.sha256).length} file hashes and parameters match`);
      marker = R.claimOos(ROOT); // exclusive create before any OOS number exists
      say(`OOS opened once: ${marker}`);
    }
    say(`mode: COMPARE ${winName} ${config.research[winName].start}..${config.research[winName].end} (simulated fills, real public data)`);
    const res = R.compare(ROOT, config, winName, strategyOpt ?? null, say);
    mkdirSync(out, { recursive: true });
    const file = join(out, `${winName}-compare.json`);
    const text = JSON.stringify(res, null, 2) + '\n';
    writeFileSync(file, text);
    if (marker) say(`sealed ${R.sealOos(ROOT, text, { results_file: file })}`);
    const b = res.baselines;
    say(`BTC hold   ${b.btc_hold.return_pct}% CAGR ${b.btc_hold.cagr_pct}% DD ${b.btc_hold.max_dd_pct}% ratio ${b.btc_hold.cagr_over_maxdd}`);
    say(`EW hold    ${b.equal_weight_hold.return_pct}% CAGR ${b.equal_weight_hold.cagr_pct}% DD ${b.equal_weight_hold.max_dd_pct}% ratio ${b.equal_weight_hold.cagr_over_maxdd}`);
    for (const [n, s] of Object.entries(res.strategies)) {
      const o = s.strategy_own, tq = s.total_equity_secondary;
      say(`${n.padEnd(12)} OWN ${o.return_pct}% CAGR ${o.cagr_pct}% DD ${o.max_dd_pct}% ratio ${o.cagr_over_maxdd} | total ${tq.return_pct}% CAGR ${tq.cagr_pct}% DD ${tq.max_dd_pct}% ratio ${tq.cagr_over_maxdd} | stress total ${s.stress.total_equity.return_pct}% | trades ${s.swing_bucket.trades} | top ${s.profit_concentration.top} ${s.profit_concentration.share_pct}% | ${s.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(s.criteria)}`);
    }
    say(`ranking (own CAGR/MaxDD): ${res.ranking.join(' > ')}; winner: ${res.winner ?? 'none'}`);
    say(`wrote ${file}`);
  } catch (e) {
    if (/OOS LOCKED/.test(e.message)) { console.error(`REFUSED: ${e.message}`); process.exit(5); }
    throw e;
  }
}

async function runFreeze() {
  const R = await import('./src/research.mjs');
  const file = R.frozenPathOf(ROOT); // fixed path, whatever --out says
  if (existsSync(R.oosMarkerOf(ROOT))) { console.error(`REFUSED: the OOS was already opened (${R.oosMarkerOf(ROOT)}); the rules cannot be re-frozen.`); process.exit(5); }
  if (existsSync(file)) { console.error(`REFUSED: ${file} exists. The freeze is one-time; OOS results must not feed back into the rules.`); process.exit(5); }
  mkdirSync(dirname(file), { recursive: true });
  const f = R.makeFrozen(ROOT, config);
  writeFileSync(file, JSON.stringify(f, null, 2) + '\n', { flag: 'wx' });
  say(`wrote ${file} (${Object.keys(f.sha256).length} file hashes)`);
}

// ---------------------------------------------------------------- --paper (synthetic fixtures)
function runFixturePaper() {
  const out = outDir();
  const assets = readJson(resolve(ROOT, config.fixtures.assets)).assets;
  const exchangeInfo = readJson(resolve(ROOT, config.fixtures.exchangeInfo));
  const universe = buildUniverse(assets, exchangeInfo, config.universe);
  say('mode: PAPER (offline fixtures, SYNTHETIC klines, not real market data)');
  for (const s of universe.skipped) say(`  skip ${s.reason}`);
  say(`  trade universe: ${universe.trade.map((m) => m.pair).join(', ') || '(none)'}`);
  say(`  longterm universe: ${universe.longterm.map((m) => m.pair).join(', ') || '(none)'}`);
  const kDir = resolve(ROOT, config.fixtures.klinesDir);
  if (!existsSync(kDir)) { console.error(`missing ${kDir}; run: node scripts/gen-fixtures.mjs`); process.exit(1); }
  const series = {};
  for (const f of readdirSync(kDir).filter((x) => x.endsWith('_15m.json')).sort()) series[f.replace('_15m.json', '')] = parseKlines(readJson(join(kDir, f)));
  const res = runPaper({ series, universe, config });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'trades.jsonl'), jsonl(res.trades));
  writeFileSync(join(out, 'longterm_buys.jsonl'), jsonl(res.ltBuys));
  writeFileSync(join(out, 'ledger.json'), JSON.stringify({
    mode: 'paper', data: 'synthetic fixtures (not real market data)',
    config: { capital: config.capital, costs: config.costs },
    ledger: res.ledger, longterm: res.longterm, stats: res.stats, risk_events: res.riskEvents, universe_skipped: universe.skipped,
  }, null, 2) + '\n');
  const bb = res.stats.by_bucket;
  say(`trades: ${res.stats.trades} (wins ${res.stats.wins}, losses ${res.stats.losses}); scalp ${bb.scalp.disabled ? 'disabled' : bb.scalp.net_pnl}, swing ${bb.swing.disabled ? 'disabled' : bb.swing.net_pnl} USDT`);
  say(`ledger: ${JSON.stringify(res.ledger)}  total ${res.stats.start_total} -> ${res.stats.end_total}`);
  for (const e of res.riskEvents) say(`  risk: ${e.time} ${e.event}`);
  say(`wrote ${join(out, 'ledger.json')}, trades.jsonl, longterm_buys.jsonl`);
}

// ---------------------------------------------------------------- real-data window replay
function holdValue(series, pair, start, capital, costs) {
  const bars = (series[pair] ?? []).filter((b) => b.t >= start);
  if (!bars.length) return null;
  const fee = costs.fee_pct / 100, slip = costs.slippage_pct / 100;
  const qty = capital / (bars[0].o * (1 + slip) * (1 + fee));
  const path = bars.map((b) => qty * b.c);
  const end = qty * bars.at(-1).c * (1 - slip) * (1 - fee);
  return { pair, entry: new Date(bars[0].t).toISOString(), last_bar: new Date(bars.at(-1).t).toISOString(), end_value: end, path, times: bars.map((b) => b.t) };
}
function maxDD(values) { let pk = 0, dd = 0; for (const v of values) { pk = Math.max(pk, v); if (pk > 0) dd = Math.max(dd, (pk - v) / pk * 100); } return r2(dd); }

function replayWindow(win, ctx) {
  const w = loadWindow(ROOT, config, win, ctx);
  const series = {};
  for (const p of w.dataPairs) {
    const bars = load15m(w.D, p, w.months).filter((b) => b.t < w.end);
    if (bars.length) series[p] = bars;
  }
  const trade = w.tu.trade_pairs.filter((p) => series[p]).map((p) => marketOf(w.ex, p));
  const missing = w.dataPairs.filter((p) => !series[p]);
  const ltMarket = new Map(w.dataPairs.filter((p) => series[p]).map((p) => [p, marketOf(w.ex, p)]));
  const res = runPaper({
    series, universe: { trade, longterm: [] }, config, tradingStart: w.start,
    ltMarketsFor: (t) => w.U.longtermAt(t).filter((p) => ltMarket.has(p)).map((p) => ltMarket.get(p)),
  });
  const s = res.summary;
  const bank = config.capital.bank;
  const btc = holdValue(series, 'BTCUSDT', w.start, bank, config.costs);
  const legs = w.tu.trade_pairs.map((p) => holdValue(series, p, w.start, bank / w.tu.trade_pairs.length, config.costs)).filter(Boolean);
  // equal-weight path on BTC's clock, each leg at its last known close (a leg that stopped trading stays flat)
  const ptr = legs.map(() => 0);
  const ewPath = btc.times.map((t) => legs.reduce((sum, l, k) => {
    while (ptr[k] + 1 < l.times.length && l.times[ptr[k] + 1] <= t) ptr[k]++;
    return sum + l.path[ptr[k]];
  }, 0));
  const ewEnd = legs.reduce((a, l) => a + l.end_value, 0);
  const swing = s.swing.disabled ? null : s.swing;
  const ltValue = r2(Object.values(s.longterm.holdings).reduce((a, h) => a + h.value_usdt, 0));
  return {
    id: win.id, start: win.start, end_exclusive: win.end,
    bars: res.stats.bars, first_bar: new Date(res.first_time).toISOString(), last_bar: new Date(res.last_time).toISOString(),
    trade_pairs: w.tu.trade_pairs, longterm_pairs_any_day: w.ltUnion, missing_15m_pairs: missing,
    swing: swing && {
      trades: swing.trades, win_rate_pct: swing.win_rate_pct, net_pnl: swing.net_pnl, fees: swing.fees,
      strategy_own_mtm_dd_pct: swing.strategy_own_mtm_dd_pct, bucket_mtm_dd_pct: swing.bucket_mtm_dd_pct, ledger_end: swing.ledger,
      by_pair: Object.fromEntries(Object.entries(res.trades.filter((x) => x.bucket === 'swing').reduce((m, x) => ((m[x.symbol] = r2((m[x.symbol] ?? 0) + x.netPnl)), m), {})).sort((a, b) => b[1] - a[1])),
    },
    scalp: s.scalp.disabled ? 'disabled by config' : s.scalp,
    longterm: { cost_usdt: s.longterm.spent_usdt, value_usdt: ltValue, cash_usdt: s.longterm.cash_usdt, holdings: s.longterm.holdings },
    reserve: s.reserve,
    bot: { start: s.start_total, end: s.equity.total, return_pct: r2((s.equity.total / s.start_total - 1) * 100), mtm_dd_pct: s.max_drawdown_pct_total },
    btc_hold: { end: r2(btc.end_value), return_pct: r2((btc.end_value / bank - 1) * 100), mtm_dd_pct: maxDD(btc.path) },
    equal_weight_hold: { pairs: legs.map((l) => l.pair), end: r2(ewEnd), return_pct: r2((ewEnd / bank - 1) * 100), mtm_dd_pct: maxDD(ewPath),
      note: 'bank split equally over the window-start trade universe, bought at the first open, marked at each leg\'s last close' },
    risk_events: res.riskEvents,
    _trades: res.trades, _ltBuys: res.ltBuys,
  };
}

function strip(o) { return Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_'))); }
function printWindow(r) {
  const sw = r.swing;
  say(`${r.id.padEnd(16)} swing ${sw.trades} tr, win ${sw.win_rate_pct}%, net ${sw.net_pnl}, fees ${sw.fees}, DD own ${sw.strategy_own_mtm_dd_pct}% / bucket ${sw.bucket_mtm_dd_pct}% | LT ${r.longterm.cost_usdt}->${r.longterm.value_usdt} | bot ${r.bot.return_pct}% (DD ${r.bot.mtm_dd_pct}%) | BTC ${r.btc_hold.return_pct}% (DD ${r.btc_hold.mtm_dd_pct}%) | EW ${r.equal_weight_hold.return_pct}% (DD ${r.equal_weight_hold.mtm_dd_pct}%)`);
  if (r.missing_15m_pairs.length) say(`  missing 15m data: ${r.missing_15m_pairs.join(' ')}`);
}

function runReplay() {
  const id = opt('--window') ?? config.real.current_window;
  const win = config.real.windows.find((w) => w.id === id);
  if (!win) { console.error(`unknown --window=${id}`); process.exit(1); }
  say(`mode: REPLAY ${id} (real public Binance 15m klines); frozen config, no tuning`);
  const r = replayWindow(win);
  const out = outDir();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'replay-summary.json'), JSON.stringify({ label: LABEL, costs: config.costs, capital: config.capital, ...strip(r) }, null, 2) + '\n');
  writeFileSync(join(out, 'replay-trades.jsonl'), jsonl(r._trades));
  writeFileSync(join(out, 'replay-longterm-buys.jsonl'), jsonl(r._ltBuys));
  printWindow(r);
  say(`wrote ${join(out, 'replay-summary.json')}, replay-trades.jsonl, replay-longterm-buys.jsonl`);
}

function runRegimes() {
  say('mode: REGIMES (same frozen swing parameters on every window; a regime check, not optimisation)');
  const ctx = loadDaily(resolve(ROOT, config.real.data_dir));
  const rows = config.real.windows.map((win) => { const r = replayWindow(win, ctx); printWindow(r); return r; });
  const out = outDir();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'regimes-summary.json'), JSON.stringify({
    label: LABEL, costs: config.costs, capital: config.capital, strategy: { swing: config.swing, risk: config.risk.swing },
    universe_rules: config.universe,
    caveats: [
      'Rank pool = every USDT pair in the current exchangeInfo (TRADING + BREAK). Pairs removed from exchangeInfo entirely are missing (survivorship gap).',
      'Supply metadata is a 2026 snapshot except dated protocol schedules (supply_history); written with hindsight.',
      'Trade universe is fixed at each window start; longterm eligibility is re-evaluated daily.',
      'Each window starts from a fresh 1430 USDT ledger; windows are independent.',
    ],
    windows: rows.map(strip),
  }, null, 2) + '\n');
  say(`wrote ${join(out, 'regimes-summary.json')}`);
}

// ---------------------------------------------------------------- --paper-forward
async function runForward() {
  const stateDir = resolve(ROOT, opt('--state') ?? config.forward.state_dir);
  const out = resolve(ROOT, opt('--out') ?? config.forward.out_dir);
  const src = opt('--source') ?? 'api';
  const fixedNow = opt('--now') ? Date.parse(opt('--now')) : null;
  const once = flag('--once') || fixedNow !== null;
  const log = (m) => say(`[${new Date().toISOString()}] ${m}`);
  let source, universe, beforeRun = async () => {};

  if (src.startsWith('file:')) {
    // offline, test-only: fixture klines and the fixture universe (static longterm list)
    const assets = readJson(resolve(ROOT, config.fixtures.assets)).assets;
    const u = buildUniverse(assets, readJson(resolve(ROOT, config.fixtures.exchangeInfo)), config.universe);
    source = fileSource(resolve(ROOT, src.slice(5)));
    universe = { trade: u.trade, pairs: u.trade.map((m) => m.pair), ltFor: () => u.longterm };
  } else if (src === 'api') {
    const net = await import('./lib/public-market-data.mjs');
    const D = resolve(ROOT, config.real.data_dir);
    const uni = readJson(join(D, 'universe.json'));
    const ex = readJson(join(D, 'exchangeInfo.json'));
    const meta = new Map(readJson(resolve(ROOT, config.real.assets)).assets.map((a) => [a.symbol, a]));
    const base = loadDaily(D);
    const extraPath = join(stateDir, 'daily-extra.json');
    const daily = () => {
      const extra = readJsonOr(extraPath, { rows: {} }).rows;
      return Object.fromEntries(Object.entries(base.daily).map(([p, rows]) => {
        const last = rows.at(-1)?.[0] ?? -Infinity;
        return [p, rows.concat((extra[p] ?? []).filter((r) => r[0] > last))];
      }));
    };
    let U = makeUniverse({ config, ex, meta, daily: daily(), first: base.first });
    beforeRun = async (now) => {
      // once per UTC day: extend daily klines of the WHOLE trading pool (point-in-time ranks)
      const cached = readJsonOr(extraPath, null);
      if (cached && Math.floor(cached.day_ms / DAY_MS) === Math.floor(now / DAY_MS)) return;
      try {
        const rowsNow = daily();
        const pool = rankPool(ex, meta, config.real.quote).filter((p) => ex.symbols.find((s) => s.symbol === p).status === 'TRADING');
        const extra = cached?.rows ?? {};
        await net.mapLimit(pool, 8, async (p) => {
          const last = rowsNow[p]?.at(-1)?.[0];
          const startTime = last !== undefined ? last + DAY_MS : now - 100 * DAY_MS;
          const k = (await net.fetchKlines(p, '1d', { startTime, retries: 2, log })).filter((x) => Number(x[6]) < now);
          extra[p] = (extra[p] ?? []).concat(k.map((x) => [Number(x[0]), Number(x[4]), Math.round(Number(x[7]))])).filter((r, i, a) => i === 0 || r[0] > a[i - 1][0]);
        });
        writeJsonAtomic(extraPath, { day_ms: now, rows: extra });
        U = makeUniverse({ config, ex, meta, daily: daily(), first: base.first });
      } catch (e) { log(`warning: daily volume refresh failed (${e.message}); using cached ranks, will retry next run`); }
    };
    const markets = new Map(uni.data_pairs.map((p) => [p, marketOf(ex, p)]));
    const lastDaily = () => Math.max(...['BTCUSDT', 'ETHUSDT'].map((p) => U.idx[p] ? (U.idx[p].d0 + U.idx[p].n - 1) * DAY_MS : 0));
    source = { name: 'api:data-api.binance.vision (public klines)', klines: (pair, startTime, endTime) => net.fetchKlines(pair, '15m', { startTime, endTime, retries: 2, log }) };
    universe = {
      trade: uni.trade_pairs.map((p) => markets.get(p)), pairs: uni.data_pairs,
      ltFor: (t) => (t - lastDaily() > 3 * DAY_MS ? [] : U.longtermAt(t).filter((p) => markets.has(p)).map((p) => markets.get(p))), // stale ranks: longterm cash waits
    };
  } else { console.error(`unknown --source=${src}`); process.exit(1); }

  say(`mode: PAPER-FORWARD (${source.name}); simulated fills only, no orders are ever sent`);
  const once1 = async (now) => {
    try { return await runForwardOnce({ config, source, universe, now, stateDir, outDir: out, log, beforeFetch: beforeRun }); }
    catch (e) { log(`ERROR (state not committed): ${e.stack ?? e.message}`); return { status: 'error' }; }
  };
  const EXIT = { error: 2, config_mismatch: 4 }; // a refused run must be visible to a scheduler
  if (once) {
    const r = await once1(fixedNow ?? Date.now());
    process.exit(EXIT[r.status] ?? 0);
  }
  for (;;) {
    const r = await once1(Date.now());
    if (r.status === 'config_mismatch') process.exit(4);
    const next = Math.ceil(Date.now() / 900_000) * 900_000 + config.forward.poll_seconds * 1000 / 4;
    await new Promise((r) => setTimeout(r, Math.max(5_000, next - Date.now())));
  }
}
