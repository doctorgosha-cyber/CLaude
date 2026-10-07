// TB-BRAIN: signals & recommendations (src/signals.mjs). Pure parts on a synthetic snapshot; the CLI on a temp data dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSignals, renderSignalsMd, readArms, DISCLAIMER, EVIDENCE } from '../src/signals.mjs';
import { marketState, DAY } from '../src/market-state.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const T0 = Date.UTC(2025, 0, 6);
const N = 420;
function walk(seed, p0, vol, drift) {
  let s = seed, p = p0; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const rows = [];
  for (let i = 0; i < N; i++) { p = p * Math.exp(drift(i) + (rnd() - 0.5) * vol); rows.push([T0 + i * DAY, Math.round(p * 1e4) / 1e4, 5e6 + 1e4 * i]); }
  return rows;
}
const DAILY = { BTCUSDT: walk(3, 50000, 0.03, (i) => (i < 300 ? 0.004 : -0.012)), ETHUSDT: walk(5, 3000, 0.04, (i) => (i < 300 ? 0.005 : -0.015)) };
for (const [k, a] of ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF'].entries()) DAILY[`${a}USDT`] = walk(9 + 2 * k, 10 - k, 0.05, (i) => (i < 300 ? 0.006 - 0.001 * k : -0.02));
const maps = Object.fromEntries(Object.keys(DAILY).map((p) => [p, new Map(DAILY[p].map((r) => [r[0], r[1]]))]));
const DUMMY = Array.from({ length: 10 }, (_, k) => `D${k}USDT`);
const ctx = { closeAt: (p, t) => (p.startsWith('D') ? 1 : maps[p]?.get(t)), universeAt: () => ['ETHUSDT', ...DUMMY, 'AAAUSDT', 'BBBUSDT', 'CCCUSDT', 'DDDUSDT', 'EEEUSDT', 'FFFUSDT'] };
const P70 = { alt_weight: 0.7, slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90, turnover_min_fresh: 2, alt_turnover: true, alt_ema_filter: null, core_pair: 'BTCUSDT' };
const ARMS = { 'M5-B100': { kind: 'alt70', params: P70 }, 'S3-M0': { kind: 'ml2', params: { slots: 5, universe_top: 40, tier_from: 10, tier_to: 40, lookback_days: 90 } }, 'M5-B100-TV': { kind: 'alt70', params: P70, vol_target: 0.6, vol_days: 7 } };
const snapUp = marketState({ daily: DAILY, ctx, arms: ARMS, t: T0 + 299 * DAY, historyFrom: T0 + 200 * DAY });
const snapDown = marketState({ daily: DAILY, ctx, arms: ARMS, t: T0 + (N - 1) * DAY, historyFrom: T0 + 200 * DAY });
const FORBIDDEN = /купуй зараз|купіть зараз|buy now|плече|леверидж|leverage|ціль \d|таргет/i;

test('buildSignals (regime on): rules say "hold the tier-2 top-5", every rule carries evidence, disclaimer fixed, no forbidden language', () => {
  const s = buildSignals(snapUp, { now: Date.UTC(2026, 9, 7), exchangeInfoNote: 'data/exchangeInfo.json' });
  assert.equal(s.disclaimer, DISCLAIMER); assert.equal(s.no_order_path, true);
  assert.equal(s.regime.label, 'risk-on'); assert.match(s.regime.label_uk, /ризик-он/);
  assert.equal(s.rules.length, Object.keys(ARMS).length);
  for (const r of s.rules) { assert.ok(EVIDENCE[r.id], r.id); assert.match(r.says, new RegExp(`правило ${r.id} зараз вимагає`)); assert.ok(r.evidence.report && r.evidence.level); assert.ok(r.next_review && r.rule); }
  assert.match(s.rules.find((r) => r.id === 'S3-M0').says, /тримати tier-2 top-5/);
  assert.ok(s.rules.find((r) => r.id === 'M5-B100-TV').proposal);
  assert.match(s.owner_question.rules_say, /НЕ бачать падіння нижче тренду/);
  assert.ok(s.risks.length >= 4);
  const md = renderSignalsMd(s);
  assert.match(md, /^# Сигнали та стан ринку/); assert.ok(md.includes(DISCLAIMER));
  assert.doesNotMatch(md, FORBIDDEN); assert.doesNotMatch(JSON.stringify(s), FORBIDDEN);
  assert.doesNotMatch(md, /derived from/, 'exchangeInfo present: no derived-pool warning');
});

test('buildSignals (regime off): rules say cash, the owner question is answered from the data, risks mention the EMA200 return', () => {
  const s = buildSignals(snapDown, { now: Date.UTC(2026, 9, 7), exchangeInfoNote: 'derived from the data files' });
  assert.ok(['risk-off', 'capitulation-watch'].includes(s.regime.label));
  assert.match(s.rules.find((r) => r.id === 'S3-M0').says, /кеш/);
  assert.match(s.rules.find((r) => r.id === 'M5-B100').says, /альт-рукав у кеші/);
  assert.match(s.owner_question.rules_say, /вимагають кеш/);
  assert.match(s.owner_question.evidence, /понеділків/);
  assert.ok(/не підтримується/.test(s.owner_question.verdict));
  assert.ok(s.risks.some((r) => /exchangeInfo відсутній/.test(r)));
  assert.ok(s.risks.some((r) => /Режим вимкнено/.test(r)));
  const md = renderSignalsMd(s);
  assert.doesNotMatch(md, FORBIDDEN);
});

test('readArms: reads ml2 / alt70 / regime states read-only, tolerates a broken file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tb-brain-arms-'));
  const w = (id, obj) => { mkdirSync(join(dir, id)); writeFileSync(join(dir, id, 'paper-state.json'), JSON.stringify(obj)); };
  w('S3-M0', { updated_at: 'x', portfolio: { kind: 'ml2', lastT: T0, start_total: 1430, equity: { total: 1400.123 }, regime_on: true, lots: [{ role: 'sleeve', pair: 'AAAUSDT', cost: 100 }, { role: 'lt', pair: 'BTCUSDT', cost: 10 }], pend: [] } });
  w('M5-B100', { updated_at: 'x', portfolio: { kind: 'alt70', lastT: T0, start_total: 1430, equity: { total: 1410 }, regimes: { alt: true, core: false }, lots: [{ role: 'sleeve', sleeve: 'alt', pair: 'BBBUSDT', cost: 100 }], pend: [{ k: 'buy', pair: 'CCCUSDT' }] } });
  w('A0', { updated_at: 'x', portfolio: { lastT: T0, start_total: 1430, equity: { total: 1420 }, regime_on: false, pos: [{ pair: 'ETHUSDT', cost: 200 }], pending: { sells: [] } } });
  mkdirSync(join(dir, 'guard')); mkdirSync(join(dir, 'ZZ')); writeFileSync(join(dir, 'ZZ', 'paper-state.json'), '{not json');
  const arms = readArms(dir);
  assert.deepEqual(arms.map((a) => a.id), ['A0', 'M5-B100', 'S3-M0', 'ZZ']);
  const m = arms.find((a) => a.id === 'M5-B100');
  assert.deepEqual(m.positions, [{ pair: 'BBBUSDT', sleeve: 'alt', cost: 100 }]); assert.equal(m.pending, 1); assert.deepEqual(m.regime, { alt: true, core: false });
  assert.deepEqual(arms.find((a) => a.id === 'S3-M0').positions.map((p) => p.pair), ['AAAUSDT'], 'longterm lots are not sleeve positions');
  assert.equal(arms.find((a) => a.id === 'A0').positions[0].pair, 'ETHUSDT');
  assert.ok(arms.find((a) => a.id === 'ZZ').broken);
  assert.equal(JSON.parse(readFileSync(join(dir, 'M5-B100', 'paper-state.json'), 'utf8')).portfolio.lots.length, 1, 'states are never written');
  rmSync(dir, { recursive: true, force: true });
});

test('CLI: node bot.mjs signals writes out/signals.json + signals.md + market-state.json from a synthetic data dir, offline', () => {
  const dir = resolve(mkdtempSync(join(tmpdir(), 'tb-brain-cli-')));
  const D = join(dir, 'data', 'daily'); mkdirSync(D, { recursive: true });
  const first = {};
  for (const [p, rows] of Object.entries(DAILY)) { writeFileSync(join(D, `${p}.json`), JSON.stringify(rows)); first[p] = rows[0][0]; }
  writeFileSync(join(D, '_first.json'), JSON.stringify(first));
  const cfg = JSON.parse(readFileSync(join(ROOT, 'config/bot.config.json'), 'utf8'));
  cfg.real.data_dir = join(dir, 'data'); cfg.forward.state_dir = join(dir, 'state'); cfg.real.assets = join(ROOT, 'config/assets.json');
  mkdirSync(join(dir, 'state')); mkdirSync(join(dir, 'config')); writeFileSync(join(dir, 'config', 'bot.config.json'), JSON.stringify(cfg));
  const r = spawnSync(process.execPath, [join(ROOT, 'bot.mjs'), 'signals', `--config=${join(dir, 'config', 'bot.config.json')}`, `--out=${join(dir, 'out')}`, '--now=2026-10-07T09:00:00Z', '--quiet'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(join(dir, 'out', 'signals.json'), 'utf8'));
  assert.equal(s.disclaimer, DISCLAIMER); assert.equal(s.generated_at, '2026-10-07T09:00:00.000Z');
  assert.ok(existsSync(join(dir, 'out', 'market-state.json')));
  const md = readFileSync(join(dir, 'out', 'signals.md'), 'utf8');
  assert.match(md, /Сигнали та стан ринку/); assert.doesNotMatch(md, FORBIDDEN);
  assert.ok(s.rules.some((x) => x.id === 'M5-B100') && s.rules.some((x) => x.id === 'M5-B100-TV'));
  // the synthetic assets have no metadata -> tiny eligible universe; the engine still answers (flagged derived pool)
  assert.match(s.exchange_info, /derived/);
  rmSync(dir, { recursive: true, force: true });
});
