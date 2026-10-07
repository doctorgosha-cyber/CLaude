// TB-BRAIN: «Сигнали та стан ринку» — a read-only view of out/signals.json (served by GET /api/signals). No imports, no
// buy/sell controls (grep proves it): every line is the output of a tested rule, with its evidence level and the fixed
// disclaimer. Works in the Khan trading panel (trading-panel.js) and in the standalone preview (signals-preview.html).
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = (p) => String(p).replace(/USDT$/, '');
const pct = (x, d = 1) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(d)} %`);
const pp = (x, d = 1) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${Number(x).toFixed(d)} %`);
const cls = (x) => (x === null || x === undefined ? '' : x > 0 ? 'up' : x < 0 ? 'down' : '');
const LABEL_CLASS = { 'risk-on': 'on', neutral: 'mid', 'risk-off': 'off', 'capitulation-watch': 'off' };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return String(iso ?? '—'); } };

/** HTML for the signals tab. `s` = signals.json or null (loading) / {error} (unavailable). */
export function signalsHtml(s, { mobile = false } = {}) {
  if (!s) return '<section class="sg" aria-label="Сигнали та стан ринку"><p class="empty">Сигнали завантажуються…</p></section>';
  if (s.error) return `<section class="sg" aria-label="Сигнали та стан ринку"><p class="empty">Сигнали недоступні: ${esc(s.error)}. Запустіть <code>node bot.mjs signals</code> у проєкті бота.</p></section>`;
  const b = s.market?.btc, br = s.market?.breadth?.eligible_universe, rel = s.market?.alt_vs_btc;
  const stale = s.data_last_close && (Date.now() - Date.parse(`${s.data_last_close}T00:00:00Z`)) > 3 * 864e5;
  const tiles = b ? `<div class="sg-tiles">
      <div class="sg-tile"><span class="k">BTC · закриття ${esc(b.as_of)}</span><b class="tnum">${esc(b.close.toLocaleString('en-US'))}</b><span class="d">USDT</span></div>
      <div class="sg-tile"><span class="k">до EMA200</span><b class="tnum ${cls(b.ema.ema200.dist_pct)}">${esc(pp(b.ema.ema200.dist_pct))}</b><span class="d">режим ${b.regime.ema200.on ? 'увімк.' : `вимк. (${esc(b.regime.ema200.closes_below)} нижче)`}</span></div>
      <div class="sg-tile"><span class="k">до EMA50</span><b class="tnum ${cls(b.ema.ema50.dist_pct)}">${esc(pp(b.ema.ema50.dist_pct))}</b><span class="d">нахил EMA200 10 д ${esc(pp(b.ema.ema200.slope_pct_10d))}</span></div>
      <div class="sg-tile"><span class="k">від 90-денного макс.</span><b class="tnum ${cls(b.dd90.pct)}">${esc(pp(b.dd90.pct))}</b><span class="d">за 28 д ${esc(pct(b.ret.d28))}</span></div>
      <div class="sg-tile"><span class="k">вол. 30 д</span><b class="tnum">${b.vol.rv30_ann == null ? '—' : esc((b.vol.rv30_ann * 100).toFixed(0)) + ' %'}</b><span class="d">перцентиль за рік ${esc(b.vol.pct_1y ?? '—')}</span></div>
      <div class="sg-tile"><span class="k">широта (вище EMA200)</span><b class="tnum">${br ? esc(br.ema200.pct ?? '—') + ' %' : '—'}</b><span class="d">${br ? `${esc(br.ema200.above)}/${esc(br.ema200.total)} придатних · EMA50 ${esc(br.ema50.pct ?? '—')} %` : ''}</span></div>
      <div class="sg-tile"><span class="k">tier-2 проти BTC · 28 д</span><b class="tnum ${cls(rel?.d28?.rel_mean)}">${esc(pct(rel?.d28?.rel_mean))}</b><span class="d">кошик ${esc(pct(rel?.d28?.basket_mean))} · BTC ${esc(pct(rel?.d28?.btc))}</span></div>
      <div class="sg-tile"><span class="k">tier-2 проти BTC · 84 д</span><b class="tnum ${cls(rel?.d84?.rel_mean)}">${esc(pct(rel?.d84?.rel_mean))}</b><span class="d">кошик ${esc(pct(rel?.d84?.basket_mean))} · BTC ${esc(pct(rel?.d84?.btc))}</span></div>
    </div>` : '';
  const rules = (s.rules ?? []).map((r) => `<li class="sg-rule${r.proposal ? ' proposal' : ''}">
      <div class="sg-rule-head"><b class="mono">${esc(r.id)}</b>${r.proposal ? '<span class="sg-tag">пропозиція · не в живому боті</span>' : ''}${r.targets?.length ? `<span class="sg-targets">${r.targets.map((t) => `<i class="mono">${esc(base(t))}</i>`).join('')}</span>` : '<span class="sg-targets"><i class="mono cash">кеш</i></span>'}</div>
      <p>${esc(r.says)}.</p>
      <small>Наступний огляд: ${esc(r.next_review)}.</small>
      <small>Правило: ${esc(r.rule)}.</small>
      <small class="ev">Докази: ${esc(r.evidence?.level ?? '—')} <span class="mono">(${esc(r.evidence?.report ?? '—')})</span></small>
    </li>`).join('');
  const q = s.owner_question;
  const risks = (s.risks ?? []).map((x) => `<li>${esc(x)}</li>`).join('');
  return `<section class="sg" aria-label="Сигнали та стан ринку">
    <p class="sg-disclaimer" role="note">${esc(s.disclaimer)}</p>
    <div class="sg-head">
      <span class="sg-regime ${esc(LABEL_CLASS[s.regime?.label] ?? 'na')}" title="${esc(s.regime?.rule ?? '')}">Режим: ${esc(s.regime?.label_uk ?? '—')}</span>
      <span class="sg-asof${stale ? ' stale' : ''}">дані до ${esc(s.data_last_close ?? '—')} · згенеровано ${esc(fmtDate(s.generated_at))}${stale ? ' · застарілі' : ''}</span>
    </div>
    <small class="sg-rule-text">Правило мітки: ${esc(s.regime?.rule ?? '—')}</small>
    ${tiles}
    <h3>Стан ринку</h3>
    <ul class="sg-status">${(s.status ?? []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Що кажуть протестовані правила зараз</h3>
    <ul class="sg-rules">${rules || '<li class="empty">немає правил</li>'}</ul>
    ${q ? `<h3>${esc(q.question)}</h3><div class="sg-q"><p><b>Правила:</b> ${esc(q.rules_say)}</p><p><b>Докази:</b> ${esc(q.evidence)}</p><p class="sg-verdict"><b>Висновок:</b> ${esc(q.verdict)}</p></div>` : ''}
    <h3>Головні ризики</h3>
    <ul class="sg-risks">${risks}</ul>
    <p class="note-partial">Усі числа — з денних закриттів (UTC) публічних даних Binance зі знімка бота; визначення кожного числа є в <span class="mono">out/signals.json → defs</span>. Жодної кнопки, що розміщує ордери, тут немає і не буде.</p>
  </section>`;
}

/** Minimal CSS for the view (also used by the preview); tokens follow the office palette (slate / cream). */
export const SIGNALS_CSS = `
.sg{display:flow-root;color:#E8E3D6;font:14px/1.45 system-ui,"Segoe UI",Roboto,Arial,sans-serif}
.sg h3{margin:16px 0 6px;font-size:15px}
.sg .mono{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}
.sg .empty{opacity:.7}
.sg-disclaimer{margin:0 0 8px;padding:8px 10px;border:1px solid #8A7F5B;border-radius:8px;background:#2A2E26;color:#F2E9C9;font-size:13px}
.sg-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.sg-regime{padding:4px 10px;border-radius:999px;font-weight:600;background:#3A4250}
.sg-regime.on{background:#1F5A3A}.sg-regime.mid{background:#5A4A1F}.sg-regime.off{background:#5A2A2A}
.sg-asof{font-size:12px;opacity:.8}.sg-asof.stale{color:#F0B35C;opacity:1}
.sg-rule-text{display:block;margin:4px 0 8px;font-size:12px;opacity:.75}
.sg-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.sg-tile{padding:8px 10px;border-radius:10px;background:#1D252E;min-width:0}
.sg-tile .k{display:block;font-size:11px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-tile .tnum{display:block;font-size:18px;font-variant-numeric:tabular-nums}
.sg-tile .d{display:block;font-size:11px;opacity:.75}
.sg .up{color:#7FD1A0}.sg .down{color:#F08A7A}
.sg-status,.sg-risks{margin:0;padding-left:18px}.sg-status li,.sg-risks li{margin:3px 0}
.sg-rules{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.sg-rule{padding:10px 12px;border-radius:10px;background:#1D252E;border-left:3px solid #4F6D8C}
.sg-rule.proposal{border-left-color:#8A7F5B;opacity:.95}
.sg-rule-head{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.sg-tag{font-size:11px;padding:2px 8px;border-radius:999px;background:#4A3F1F;color:#F2E9C9}
.sg-targets{display:flex;flex-wrap:wrap;gap:4px;margin-left:auto}
.sg-targets i{font-style:normal;font-size:12px;padding:2px 7px;border-radius:6px;background:#2B3A4A}
.sg-targets i.cash{background:#3A3A3A}
.sg-rule p{margin:6px 0 4px}.sg-rule small{display:block;font-size:12px;opacity:.8}.sg-rule small.ev{opacity:.9;color:#D9CFA8}
.sg-q{padding:10px 12px;border-radius:10px;background:#1D252E}.sg-q p{margin:4px 0}.sg-verdict{color:#F2E9C9}
.note-partial{font-size:12px;opacity:.7}
@media (max-width:420px){.sg-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.sg-tile .tnum{font-size:16px}.sg-targets{margin-left:0}}
`;

/** Two-tab shell: «Автоторгівля (папір)» | «Сигнали та стан ринку». Tabs are plain buttons; nothing trades. */
export function tabsHtml(active) {
  const t = (id, label) => `<button type="button" role="tab" data-tab="${id}" aria-selected="${active === id}" id="tab-${id}" aria-controls="panel-${id}">${label}</button>`;
  return `<div class="tp-tabs" role="tablist" aria-label="Розділи торгової кімнати">${t('auto', 'Автоторгівля (папір)')}${t('signals', 'Сигнали та стан ринку')}</div>`;
}
export const TABS_CSS = `
.tp-tabs{display:flex;gap:6px;margin:8px 0 10px;position:sticky;top:0;z-index:2;background:inherit}
.tp-tabs button{flex:1 1 0;min-height:40px;padding:8px 10px;border-radius:10px;border:1px solid #3A4250;background:#1D252E;color:#E8E3D6;font:inherit;font-weight:600;cursor:pointer}
.tp-tabs button[aria-selected="true"]{background:#4F6D8C;border-color:#4F6D8C;color:#fff}
.tp-panel[hidden]{display:none}
`;

/** Fetch /api/signals (read-only). Resolves to the JSON, or {error}. */
export async function fetchSignals(url = '/api/signals') {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return await r.json();
  } catch (e) { return { error: e?.message ?? 'мережа' }; }
}
