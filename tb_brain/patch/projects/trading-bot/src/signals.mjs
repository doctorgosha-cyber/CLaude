// TB-BRAIN: signals & recommendations = the OUTPUT OF TESTED RULES on the current market-state snapshot, with the evidence
// level of each rule and the main risks. Plain Ukrainian copy. Never a target price, never leverage, never "buy now".
// buildSignals / renderSignalsMd are pure; collectSignalsInputs reads the bot's files (no network, no orders).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { marketState, DAY } from './market-state.mjs';
import { makeUniverse, loadDaily } from './realdata.mjs';
import { resolveVariants, M5_B100_TV_PROPOSAL } from './variants.mjs';
import { ownEma } from './alt70.mjs';

export const DISCLAIMER = 'Це вихід протестованих правил, не персональна фінансова порада. Папір: жодних ключів, акаунтів чи ордерів.';
const pct = (x, d = 1) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)} %`);
const pp = (x, d = 1) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${Number(x).toFixed(d)} %`);
const base = (p) => String(p).replace(/USDT$/, '');
const r2 = (x) => Math.round(x * 100) / 100;

/** Evidence table: every rule points to the report that tested it and the verdict written there. */
export const EVIDENCE = Object.freeze({
  'M5-B100': { report: 'reports/TB-ALT70.md', level: 'forward paper від 2026-10-05; бектест 2021-11..2026-10: CAGR/DD 0.527, MaxDD 46.6 %, DSR ≤ 0.09 — без доведеної переваги' },
  C8: { report: 'reports/TB-ARM1314.md', level: 'forward paper від 2026-10-05; FULGRIM-STRAT R2 — без доведеної переваги (NOT FOUND)' },
  'S3-M0': { report: 'reports/TB-RECENT3.md', level: 'forward paper; tier-2 momentum — TB-TIER2: «no tier-2 method beats A0 on risk», без доведеної переваги' },
  'M5-B100-TV': { report: 'tb_predict/REPORT.md (TB-PREDICT)', level: 'тільки бектест: MaxDD нижчий в обох періодах, Sharpe без змін у design, дохідність нижча; формальний критерій не пройдено; не edge' },
  regime: { report: 'reports/TB-STRAT-V2-OOS.md', level: 'EMA200-режим — єдиний ризик-контроль A-арм; OOS: жоден кандидат не пройшов' },
  direction: { report: 'tb_predict/REPORT.md (TB-PREDICT)', level: 'напрямок на 4h/1d/1w після комісій не передбачуваний (усі DSR ≤ 0.01); calm-вікна не допомагають' },
  dip: { report: 'reports/TB-ARM1314.md / OWNER-RULES.md', level: 'резерв 300 USDT витрачає лише протестоване dip-правило (A5 C2v2: BTC ≤ 70/60/50 % від 365-денного максимуму); інших «купити просадку» правил немає' },
});

const NEXT_UK = {
  'this close is a Monday review': 'це закриття понеділка — огляд сьогодні, виконання на наступному відкритті',
  'next Monday close (or a regime turn-on close)': 'наступне закриття понеділка (або закриття, на якому режим увімкнеться)',
  'next Monday close (core: daily; a regime turn-on close enters at the next open)': 'наступне закриття понеділка (ядро BTC перевіряється щодня; вмикання режиму = вхід на наступному відкритті)',
};
const RULE_UK = {
  'M5-B100': '70 % tier-2 momentum (правила S3-M0, режим BTC EMA200) + 30 % BTC на режимі BTC EMA100; огляд щопонеділка на закритті, виконання на наступному відкритті',
  C8: 'як M5-B100, але кандидат має закритися вище власної EMA50, а список замінюється щотижня точно',
  'S3-M0': 'tier-2 momentum: ранг rel90 (90-денна дохідність проти BTC) серед позицій 11..40 за обсягом без ETH; режим BTC EMA200; 5 слотів; ротація лише при ≥ 2 нових іменах',
  'M5-B100-TV': 'M5-B100 плюс масштаб ваг min(1, 0.60 / 7-денна річна волатильність кошика) при купівлі; пропозиція з TB-PREDICT, не в живому боті',
};
const labelUk = { 'risk-on': 'ризик-он (тренд угору)', neutral: 'нейтрально (тренд угору, але слабшає)', 'risk-off': 'ризик-оф (BTC нижче тренду)', 'capitulation-watch': 'спостереження за капітуляцією' };

/** Live paper arms from state/<id>/paper-state.json (read-only). */
export function readArms(stateRoot) {
  const out = [];
  if (!existsSync(stateRoot)) return out;
  for (const id of readdirSync(stateRoot)) {
    const f = join(stateRoot, id, 'paper-state.json');
    if (!existsSync(f)) continue;
    try {
      const s = JSON.parse(readFileSync(f, 'utf8')), P = s.portfolio ?? {};
      const kind = P.kind ?? 'regime';
      const lots = kind === 'ml2' || kind === 'alt70' ? (P.lots ?? []).filter((l) => l.role === 'sleeve') : kind === 'rel' ? [] : (P.pos ?? []);
      out.push({ id, kind, updated_at: s.updated_at, last_day: P.lastT ? new Date(P.lastT).toISOString().slice(0, 10) : null,
        equity_total: r2(P.equity?.total ?? NaN), start_total: P.start_total ?? null, regime: kind === 'alt70' ? P.regimes : kind === 'rel' ? null : { on: P.regime_on },
        positions: lots.map((l) => ({ pair: l.pair, sleeve: l.sleeve ?? null, cost: r2(l.cost) })), pending: (P.pend ?? P.pending?.sells ?? []).length, last_targets: P.last_targets ?? null, label: s.label ?? null });
    } catch (e) { out.push({ id, broken: String(e.message).slice(0, 120) }); }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

/**
 * Inputs from the bot's files: daily compact closes (data/daily), config/assets.json, data/exchangeInfo.json when present
 * (else a pool derived from the data files, flagged), live arm states. No network.
 */
export function collectSignalsInputs({ root, config, dataDir = null, stateRoot = null }) {
  const D = resolve(root, dataDir ?? config.real.data_dir);
  const { daily, first } = loadDaily(D);
  const meta = new Map(JSON.parse(readFileSync(resolve(root, config.real.assets), 'utf8')).assets.map((a) => [a.symbol, a]));
  const exPath = join(D, 'exchangeInfo.json');
  let ex, exNote;
  if (existsSync(exPath)) { ex = JSON.parse(readFileSync(exPath, 'utf8')); exNote = 'data/exchangeInfo.json'; }
  else { ex = { symbols: Object.keys(daily).map((p) => ({ symbol: p, baseAsset: p.slice(0, -config.real.quote.length), quoteAsset: config.real.quote, status: 'TRADING', filters: [] })) }; exNote = 'derived from the data files (data/exchangeInfo.json absent): statuses unknown, all treated as TRADING'; }
  const cfgU = { ...config, real: { ...config.real, max_trade_pairs: 1000 } };
  const U = makeUniverse({ config: cfgU, ex, meta, daily, first });
  const closeAt = (p, d) => { const ix = U.idx[p]; if (!ix) return undefined; const i = Math.floor(d / DAY) - ix.d0; return i >= 0 && i < ix.n && ix.has[i] ? ix.close[i] : undefined; };
  const uniCache = new Map();
  const universeAt = (t) => { const k = Math.floor(t / DAY); if (!uniCache.has(k)) uniCache.set(k, U.tradeUniverse(t + DAY).trade_pairs); return uniCache.get(k); };
  const emaCache = new Map();
  const emaAt = (p, d, n) => { // C8 own-EMA filter, exactly as forward-daily.mjs buildContext
    const ix = U.idx[p]; if (!ix) return NaN;
    const key = `${p}:${n}`;
    if (!emaCache.has(key)) { const c = new Float64Array(ix.n); for (let i = 0; i < ix.n; i++) c[i] = ix.has[i] ? ix.close[i] : NaN; emaCache.set(key, ownEma(c, n)); }
    const i = Math.floor(d / DAY) - ix.d0, a = emaCache.get(key);
    return i >= 0 && i < a.length ? a[i] : NaN;
  };
  const V = Object.fromEntries(resolveVariants(config).map((v) => [v.id, v]));
  const arms = {};
  for (const id of ['M5-B100', 'C8', 'S3-M0']) if (V[id]) arms[id] = { kind: V[id].strategy === 'ml2' ? 'ml2' : 'alt70', params: V[id].strategy === 'ml2' ? V[id].ml2 : V[id].alt70 };
  const tvv = resolveVariants({ ...config, forward: { ...config.forward, variants: [M5_B100_TV_PROPOSAL] } })[0];
  arms['M5-B100-TV'] = { kind: 'alt70', params: tvv.alt70, vol_target: tvv.alt70.vol_target, vol_days: tvv.alt70.vol_days, proposal: true };
  return { daily, ctx: { closeAt, universeAt, emaAt }, arms, exchange_info: exNote, live_arms: readArms(resolve(root, stateRoot ?? config.forward.state_dir)) };
}

/** Pure: snapshot (+ live arms) -> signals object. */
export function buildSignals(snap, { liveArms = [], now = null, exchangeInfoNote = null } = {}) {
  const b = snap.btc, e200 = b.regime.ema200, e100 = b.regime.ema100;
  const rel = snap.alt_vs_btc, ev = snap.evidence_alts_when_btc_falls;
  const status = [];
  status.push(`BTC ${b.close.toLocaleString('en-US')} USDT на ${snap.as_of}: ${pp(b.ema.ema200.dist_pct)} до EMA200, ${pp(b.ema.ema50.dist_pct)} до EMA50; ${pp(b.dd90.pct)} від 90-денного максимуму; за 28 днів ${pct(b.ret.d28)}.`);
  status.push(`Режим EMA200 (правило бота): ${e200.on ? 'УВІМКНЕНО' : `ВИМКНЕНО (${e200.closes_below} закриттів нижче)`}; режим EMA100 (ядро M5-B100): ${e100.on ? 'увімкнено' : 'вимкнено'}.`);
  status.push(`Широта: ${snap.breadth.eligible_universe.ema200.pct ?? '—'} % придатних монет вище EMA200 (${snap.breadth.eligible_universe.ema200.above}/${snap.breadth.eligible_universe.ema200.total}), ${snap.breadth.eligible_universe.ema50.pct ?? '—'} % вище EMA50.`);
  status.push(`Tier-2 кошик проти BTC: 28 днів ${pct(rel.d28.rel_mean)} (кошик ${pct(rel.d28.basket_mean)}, BTC ${pct(rel.d28.btc)}); 84 дні ${pct(rel.d84.rel_mean)}.`);
  status.push(`Волатильність BTC (30 д): ${b.vol.rv30_ann === null ? '—' : `${(b.vol.rv30_ann * 100).toFixed(0)} % річних`}, перцентиль за рік ${b.vol.pct_1y ?? '—'}.`);
  status.push(`Мітка режиму: ${labelUk[snap.regime.label] ?? snap.regime.label} — правило: ${snap.regime.rule}.`);

  const rules = [];
  for (const [id, a] of Object.entries(snap.arms)) {
    const evd = EVIDENCE[id] ?? { report: '—', level: 'без оцінки' };
    let says;
    if (a.kind === 'ml2') says = a.regime.ema200 ? `правило S3-M0 зараз вимагає тримати tier-2 top-5: ${a.targets.map(base).join(', ') || '—'}` : 'правило S3-M0 зараз вимагає кеш (режим EMA200 вимкнено: усі лоти продаються на наступному відкритті)';
    else {
      const parts = [];
      parts.push(a.regime.ema200_alt ? `альт-рукав ${Math.round(a.target_weights.alt * 100)} % у tier-2 top-5: ${a.targets.map(base).join(', ') || '—'}` : 'альт-рукав у кеші (режим EMA200 вимкнено)');
      parts.push(a.regime.ema100_core ? `ядро ${Math.round(a.target_weights.core * 100)} % у BTC` : 'ядро у кеші (режим EMA100 вимкнено)');
      if (a.cash_weight > 0) parts.push(`кеш ${Math.round(a.cash_weight * 100)} %`);
      says = `правило ${id} зараз вимагає: ${parts.join('; ')}`;
      if (a.tv_overlay) says += `; TV-оверлей: масштаб ${a.tv_overlay.scale.toFixed(2)} (вол. кошика ${a.tv_overlay.basket_vol_ann === null ? '—' : `${(a.tv_overlay.basket_vol_ann * 100).toFixed(0)} %`} проти цілі ${(a.tv_overlay.target * 100).toFixed(0)} %) → ефективно альти ${(a.tv_overlay.effective_weights.alt * 100).toFixed(0)} %, BTC ${(a.tv_overlay.effective_weights.core * 100).toFixed(0)} %`;
    }
    rules.push({ id, says, next_review: NEXT_UK[a.next_review] ?? a.next_review, rule: RULE_UK[id] ?? a.rule, evidence: evd, proposal: !!a.tv_overlay, targets: a.targets ?? [], tier2_top: a.tier2_top ?? [], regime: a.regime, target_weights: a.target_weights ?? null, tv_overlay: a.tv_overlay ?? null });
  }

  // the Owner's question, answered from the rules and the data
  const on = ev.regime_on, off = ev.regime_off, drop = ev.btc_drop;
  const ownerQuestion = {
    question: '«BTC падає — може, купувати альти?»',
    rules_say: e200.on
      ? `Правила бота НЕ бачать падіння нижче тренду: BTC на ${pp(b.ema.ema200.dist_pct)} вище EMA200, режим увімкнено, тому альт-рукави M5-B100 / C8 / S3-M0 і так у tier-2 top-5. Окремого правила «купити альти, бо BTC падає» немає і воно не тестоване.`
      : `Режим EMA200 вимкнено: усі протестовані правила вимагають кеш (альти) ${e100.on ? 'і BTC-ядро 30 %' : 'і кеш у ядрі'}. Жодне правило не купує альти, коли BTC нижче тренду. Резерв витрачає тільки dip-правило A5 (BTC ≤ 70 % від річного максимуму).`,
    evidence: `Дані ${ev.def}. За ${ev.weeks} понеділків: коли режим EMA200 УВІМКНЕНО (${on.weeks} тижнів), медіана 28-денного результату tier-2 кошика ${pct(on.alt_median)} проти BTC ${pct(on.btc_median)}, альти обганяли BTC у ${on.alts_beat_btc_pct ?? '—'} % випадків; коли ВИМКНЕНО (${off.weeks} тижнів): кошик ${pct(off.alt_median)} проти BTC ${pct(off.btc_median)}, обганяли у ${off.alts_beat_btc_pct ?? '—'} %, кошик був у плюсі лише у ${off.alts_positive_pct ?? '—'} % тижнів. У тижні, коли BTC далі падав > 5 % (${drop.all.weeks}): кошик ${pct(drop.all.alt_median)} при BTC ${pct(drop.all.btc_median)}${drop.regime_off.weeks ? `; з них при вимкненому режимі (${drop.regime_off.weeks}): кошик ${pct(drop.regime_off.alt_median)}` : ''}.`,
    verdict: (off.alt_median !== undefined && off.alt_median !== null && off.alt_median < (on.alt_median ?? 0) && (drop.all.alt_median ?? 0) < (drop.all.btc_median ?? 0))
      ? 'Історія в наших даних каже: коли BTC нижче тренду або продовжує падати, tier-2 альти в середньому падають СИЛЬНІШЕ за BTC. Ідея «BTC падає → купити альти» правилами не підтримується.'
      : 'У наших даних немає стійкого підтвердження, що альти виграють, коли BTC падає. Ідея правилами не підтримується.',
  };

  const risks = [
    'Жодна арма не має доведеної переваги над утриманням BTC після комісій (DSR); усі помічені «NO PROVEN EDGE».',
    `Поточна просадка BTC від 90-денного максимуму ${pp(b.dd90.pct)}; у 2022 утримання втратило близько двох третин.`,
    e200.on ? `Режим вимкнеться після 3 закриттів нижче EMA200 (${b.ema.ema200.value.toLocaleString('en-US')}): тоді правила продають усі альт-лоти на наступному відкритті.` : 'Режим вимкнено: правила не купують альти, доки закриття не повернеться вище EMA200.',
    'Tier-2 кошик концентрований (5 імен) і торгується раз на тиждень; між оглядами правила нічого не роблять, навіть якщо ціна падає.',
    'Дані = денні закриття зі знімка пакета; хмарне середовище не має доступу до Binance, тож знімок може відставати від живого стану на 1–3 дні.',
  ];
  if (exchangeInfoNote && /derived/.test(exchangeInfoNote)) risks.push('exchangeInfo відсутній у пакеті: пул пар виведено з файлів даних, статуси торгівлі невідомі.');

  return {
    label: 'СИГНАЛИ · PAPER · вихід протестованих правил', generated_at: new Date(now ?? Date.now()).toISOString(), as_of: snap.as_of, data_last_close: snap.data_last_close,
    disclaimer: DISCLAIMER, regime: { label: snap.regime.label, label_uk: labelUk[snap.regime.label] ?? snap.regime.label, rule: snap.regime.rule },
    status, rules, owner_question: ownerQuestion, risks,
    market: { btc: b, eth: snap.eth, breadth: snap.breadth, alt_vs_btc: snap.alt_vs_btc, evidence_alts_when_btc_falls: ev },
    live_arms: liveArms, defs: snap.defs, exchange_info: exchangeInfoNote, no_order_path: true,
  };
}

/** Pure: signals -> Ukrainian markdown. */
export function renderSignalsMd(s) {
  const L = [];
  L.push(`# Сигнали та стан ринку · PAPER · станом на ${s.as_of} (закриття дня, UTC)`);
  L.push('');
  L.push(`> ${s.disclaimer}`);
  L.push('');
  L.push(`**Режим:** ${s.regime.label_uk} · правило: ${s.regime.rule}`);
  L.push('');
  L.push('## Стан ринку');
  for (const x of s.status) L.push(`- ${x}`);
  L.push('');
  L.push('## Що кажуть протестовані правила зараз');
  for (const r of s.rules) {
    L.push(`- **${r.id}${r.proposal ? ' (пропозиція, не в живому боті)' : ''}:** ${r.says}.`);
    L.push(`  - наступний огляд: ${r.next_review}; правило: ${r.rule}`);
    L.push(`  - рівень доказів: ${r.evidence.level} (${r.evidence.report})`);
  }
  L.push('');
  L.push(`## ${s.owner_question.question}`);
  L.push(`- Правила: ${s.owner_question.rules_say}`);
  L.push(`- Докази: ${s.owner_question.evidence}`);
  L.push(`- Висновок: ${s.owner_question.verdict}`);
  L.push('');
  L.push('## Головні ризики');
  for (const x of s.risks) L.push(`- ${x}`);
  L.push('');
  if (s.live_arms?.length) {
    L.push('## Живі paper-арми (стан файлів)');
    for (const a of s.live_arms) {
      if (a.broken) { L.push(`- ${a.id}: стан не читається (${a.broken})`); continue; }
      const pos = a.positions.map((p) => base(p.pair)).join(', ') || 'кеш';
      L.push(`- ${a.id}: капітал ${a.equity_total} / старт ${a.start_total}, день ${a.last_day}, позиції: ${pos}${a.pending ? `, відкладених ордерів ${a.pending}` : ''}`);
    }
    L.push('');
  }
  L.push(`_Згенеровано ${s.generated_at}; дані до ${s.data_last_close}; ${s.exchange_info ?? ''}. Жодного шляху ордерів у коді немає._`);
  return L.join('\n') + '\n';
}

/** Orchestration used by `node bot.mjs signals`. */
export function makeSignals({ root, config, dataDir = null, stateRoot = null, now = null, t = null }) {
  const inp = collectSignalsInputs({ root, config, dataDir, stateRoot });
  const snap = marketState({ daily: inp.daily, ctx: inp.ctx, arms: inp.arms, t });
  const signals = buildSignals(snap, { liveArms: inp.live_arms, now, exchangeInfoNote: inp.exchange_info });
  return { snapshot: snap, signals, markdown: renderSignalsMd(signals) };
}
