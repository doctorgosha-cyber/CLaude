// A-TRADING: the 2D trading dashboard. Wraps hud.renderTrading (hud.js untouched): the HUD still renders its header,
// PAPER banner and the 14-arm table; this module inserts, right after the banner, the equity header + sparkline,
// a hand-rolled candlestick chart with symbol tabs (1d from local bars, 1h from local bars or live), the holdings
// table, the decisions feed and the regime badge. Everything read-only; there are no buy/sell controls (grep proves it).
// TB-BRAIN: the panel is split into two clearly separated tabs: «Автоторгівля (папір)» (this module's existing content +
// the HUD arm table) and «Сигнали та стан ринку» (signals-view.js over GET /api/signals, read-only, refreshed every 5 min).
import { drawCandles, drawSparkline, fmtPrice, fmtPct, pctColor, base, pickChartSymbols } from './charts.js';
import * as F from './fmt.js';
import { signalsHtml, tabsHtml, fetchSignals, SIGNALS_CSS, TABS_CSS } from './signals-view.js';

const esc = F.esc;

export function installTradingPanel(hud, { mobile = false } = {}) {
  const orig = hud.renderTrading.bind(hud);
  const st = { symbol: null, interval: '1d', market: null, tab: 'auto', signals: null, signalsAt: 0 };
  let ro = null;
  if (!document.getElementById('tp-signals-css')) { const css = document.createElement('style'); css.id = 'tp-signals-css'; css.textContent = TABS_CSS + SIGNALS_CSS; document.head.appendChild(css); }
  try { const saved = localStorage.getItem('tp.tab'); if (saved === 'signals' || saved === 'auto') st.tab = saved; } catch { /* storage may be blocked */ }

  const sel = () => {
    const m = st.market; if (!m) return null;
    const syms = m.symbols ?? [];
    if (!st.symbol || !syms.some((s) => s.symbol === st.symbol)) st.symbol = pickChartSymbols(m)[0] ?? syms[0]?.symbol ?? null;
    return syms.find((s) => s.symbol === st.symbol) ?? null;
  };
  const armsShort = (arms) => (arms.length <= 3 ? arms.join(', ') : `${arms.slice(0, 2).join(', ')} … ${arms[arms.length - 1]} (${arms.length})`);

  function html() {
    const m = st.market, tr = hud.trading;
    const t = tr?.totals ?? null, all = t && t.withEquity === t.arms && t.arms > 0;
    const pnl = all && t.start ? ((t.equity - t.start) / t.start) * 100 : null;
    const rg = m?.regime ?? null;
    const rgWord = !rg || !rg.state ? 'немає даних' : rg.state === 'on' ? `увімкнено · ${rg.on} рук` : rg.state === 'off' ? `вимкнено · ${rg.off} рук` : `змішаний · ${rg.on} увімк / ${rg.off} вимк`;
    const held = new Set((m?.held ?? []).map((h) => h.symbol));
    const tabs = (m?.symbols ?? []).map((s) => `<button type="button" role="tab" data-sym="${esc(s.symbol)}" aria-selected="${s.symbol === st.symbol}" title="${esc(s.symbol)}${held.has(s.symbol) ? ' · у портфелі' : ''}">${held.has(s.symbol) ? '<i class="dot"></i>' : ''}${esc(base(s.symbol))}</button>`).join('');
    const holdRows = (m?.held ?? []).map((h) => { const s = (m.symbols ?? []).find((q) => q.symbol === h.symbol); return `<tr><td class="mono"><b>${esc(base(h.symbol))}</b></td><td title="${esc(h.arms.join(', '))}">${esc(armsShort(h.arms))}</td><td class="num">${esc(fmtPrice(h.qty))}</td><td class="num">${h.value == null ? '—' : esc(F.money(h.value))}</td><td class="num">${h.sharePct == null ? '—' : esc(F.pct(h.sharePct).replace('+', ''))}</td><td class="num ${s && s.change24h != null ? (s.change24h > 0 ? 'up' : s.change24h < 0 ? 'down' : '') : ''}">${s && s.change24h != null ? esc(fmtPct(s.change24h)) : '—'}</td></tr>`; }).join('');
    const decs = (tr?.arms ?? []).flatMap((a) => (a.decisions ?? []).map((d) => ({ ...d, arm: a.id }))).filter((d) => d.date).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.arm).localeCompare(String(b.arm), 'en', { numeric: true })).slice(0, 8);
    const decRows = decs.map((d) => `<li><span class="mono">${esc(F.day(d.date))}</span> <b class="mono">${esc(d.arm)}</b> · ${esc(d.review?.kind ?? (d.regimeOn === false ? 'regime off' : 'без змін'))}${d.review?.targets?.length ? ` · ${esc(d.review.targets.map(base).join(', '))}` : ''}${d.positions != null ? ` · позицій ${esc(d.positions)}` : ''}${d.equityTotal != null ? ` · капітал ${esc(F.money(d.equityTotal))}` : ''}</li>`).join('');
    const src = m ? (m.live ? `LIVE · Binance, публічні дані без ключів · ${esc(F.time(m.liveAt))}` : esc(m.note)) : 'дані ринку завантажуються…';
    return `<section class="tf" aria-label="Торговий стіл (PAPER)">
      <div class="tf-head">
        <div class="tf-eq"><span class="k">Капітал усіх рук · PAPER</span><b class="tnum">${all ? esc(F.money(t.equity)) + ' USDT' : '—'}</b>
          <span class="d ${pnl == null ? '' : pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}">${pnl == null ? 'старт —' : `${esc(fmtPct(pnl))} від старту ${esc(F.money0(t.start))} USDT`}</span></div>
        <div class="tf-spark-wrap"><canvas class="tf-spark" width="240" height="64" aria-label="Капітал по днях (сума рук)"></canvas><small>капітал по днях · ${esc(String(m?.equity?.points?.length ?? 0))} точок</small></div>
        <div class="tf-badges"><span class="tf-regime ${esc(rg?.state ?? 'na')}">Режим EMA200: ${esc(rgWord)}</span><span class="tf-src ${m?.live ? 'live' : 'off'}">${src}</span></div>
      </div>
      <div class="tf-tabs" role="tablist" aria-label="Монета">${tabs || '<span class="empty">немає символів</span>'}</div>
      <div class="tf-chart-wrap"><canvas class="tf-chart" role="img" aria-label="Свічковий графік"></canvas>
        <div class="tf-iv" role="group" aria-label="Інтервал"><button type="button" data-iv="1d" aria-pressed="${st.interval === '1d'}">1d</button><button type="button" data-iv="1h" aria-pressed="${st.interval === '1h'}">1h</button></div></div>
      <h3>Позиції · сума по ${esc(String(tr?.arms?.length ?? '—'))} руках · PAPER</h3>
      ${holdRows ? `<div class="tf-scroll"><table class="tf-hold"><thead><tr><th>Монета</th><th>Руки</th><th class="num">К-ть</th><th class="num">Вартість, USDT</th><th class="num">Частка</th><th class="num">24h</th></tr></thead><tbody>${holdRows}</tbody></table></div>` : '<p class="empty">Відкритих позицій немає.</p>'}
      <p class="note-partial">Вартість — за останнім закриттям у paper-state кожної руки; частка — від суми позицій усіх рук. Руки незалежні (у кожної свої 1 430 USDT).</p>
      <h3>Останні рішення</h3>${decRows ? `<ul class="tf-dec">${decRows}</ul>` : '<p class="empty">Ще немає.</p>'}
      <h3>Руки · ${esc(String(tr?.arms?.length ?? 0))} · PAPER</h3>
    </section>`;
  }

  function drawChart(sec) {
    const c = sec.querySelector('.tf-chart'); if (!c) return;
    const wrap = c.parentElement, w = Math.max(240, Math.round(wrap.clientWidth)), h = mobile ? Math.max(200, Math.round(w * 0.6)) : 320;
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = `${w}px`; c.style.height = `${h}px`;
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = sel(); const m = st.market;
    const candles = s ? (st.interval === '1h' ? s.candles1h : s.candles) ?? [] : [];
    const held = s ? (m.held ?? []).find((q) => q.symbol === s.symbol) : null;
    drawCandles(ctx, { x: 0, y: 0, w, h }, candles, {
      title: s ? base(s.symbol) : '—', sub: s ? `${st.interval} · ${st.interval === '1h' && s.source === 'binance-public' ? 'live Binance' : s.source === 'none' ? 'без барів' : 'локальні бари'}${held ? ` · у ${held.arms.length} рук` : ''}${s.asOf && !mobile ? ` · останній бар ${F.dmTime(s.asOf)}` : ''} · PAPER` : '',
      lastClose: s?.lastClose ?? null, change24h: s?.change24h ?? null, interval: st.interval, scale: mobile ? 0.9 : 1, compact: mobile,
      emptyText: s ? 'немає локальних барів для цієї монети' : 'немає даних',
    });
    c.setAttribute('aria-label', s ? `Свічковий графік ${base(s.symbol)}, ${st.interval}, ${candles.length} барів, останнє закриття ${fmtPrice(s.lastClose)}` : 'Свічковий графік: немає даних');
    const sp = sec.querySelector('.tf-spark');
    if (sp) {
      const pts = m?.equity?.points ?? []; const maxArms = Math.max(0, ...pts.map((p) => p.arms));
      const full = pts.filter((p) => p.arms === maxArms);
      // days with every arm: the sum; otherwise (arms were still being added) the average per arm, labelled so
      const perArm = full.length < 2;
      const use = perArm ? pts : full;
      const vals = use.map((p) => (perArm ? p.total / Math.max(1, p.arms) : p.total));
      const sctx = sp.getContext('2d'); sctx.setTransform(1, 0, 0, 1, 0, 0);
      drawSparkline(sctx, { x: 0, y: 0, w: sp.width, h: sp.height }, vals, { bg: '#1D252E', label: use.length ? `${use[0].date.slice(5)} → ${use[use.length - 1].date.slice(5)}${perArm ? ' · на руку' : ''}` : '', value: vals.length ? F.money0(vals[vals.length - 1]) : '—', emptyText: 'замало днів для лінії' });
      sec.querySelector('.tf-spark-wrap small').textContent = perArm ? `середній капітал на руку по днях · ${pts.length} точок (руки додавалися)` : `сума капіталу рук по днях · ${use.length} точок`;
    }
  }

  function wire(sec) {
    sec.querySelectorAll('[data-sym]').forEach((b) => b.addEventListener('click', () => { st.symbol = b.dataset.sym; sec.querySelectorAll('[data-sym]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); drawChart(sec); }));
    sec.querySelectorAll('[data-iv]').forEach((b) => b.addEventListener('click', () => { st.interval = b.dataset.iv; sec.querySelectorAll('[data-iv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawChart(sec); }));
    ro?.disconnect(); ro = new ResizeObserver(() => drawChart(sec)); ro.observe(sec.querySelector('.tf-chart-wrap'));
  }

  function applyTab(body) {
    body.querySelectorAll('.tp-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)));
    const auto = body.querySelector('#panel-auto'), sig = body.querySelector('#panel-signals');
    if (auto) auto.hidden = st.tab !== 'auto';
    if (sig) sig.hidden = st.tab !== 'signals';
  }
  async function refreshSignals(force = false) {
    if (!force && st.signals && Date.now() - st.signalsAt < 5 * 60_000) return;
    st.signals = await fetchSignals('/api/signals'); st.signalsAt = Date.now();
    const sig = document.querySelector('#trading #panel-signals'); if (sig) sig.innerHTML = signalsHtml(st.signals, { mobile });
  }

  hud.renderTrading = () => {
    orig();
    const el = document.querySelector('#trading'); const body = el?.querySelector('.body'); if (!body) return;
    const banner = body.querySelector('.banner');
    // tab 1 «Автоторгівля (папір)»: the HUD's own content (the PAPER banner stays above both tabs) + this module's section
    const auto = document.createElement('div'); auto.id = 'panel-auto'; auto.className = 'tp-panel'; auto.setAttribute('role', 'tabpanel'); auto.setAttribute('aria-labelledby', 'tab-auto');
    const after = banner ? [...body.children].slice([...body.children].indexOf(banner) + 1) : [...body.children];
    const sec = document.createElement('div'); sec.innerHTML = html();
    const node = sec.firstElementChild;
    auto.append(node, ...after);
    // tab 2 «Сигнали та стан ринку»: read-only, from /api/signals
    const sig = document.createElement('div'); sig.id = 'panel-signals'; sig.className = 'tp-panel'; sig.setAttribute('role', 'tabpanel'); sig.setAttribute('aria-labelledby', 'tab-signals');
    sig.innerHTML = signalsHtml(st.signals, { mobile });
    const tabs = document.createElement('div'); tabs.innerHTML = tabsHtml(st.tab);
    const tabsNode = tabs.firstElementChild;
    if (banner) banner.after(tabsNode); else body.prepend(tabsNode);
    tabsNode.after(auto, sig);
    tabsNode.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      st.tab = b.dataset.tab; try { localStorage.setItem('tp.tab', st.tab); } catch { /* ignore */ }
      applyTab(body); if (st.tab === 'signals') refreshSignals(); else drawChart(node);
    }));
    applyTab(body);
    wire(node); drawChart(node);
    refreshSignals();
  };
  return {
    setMarket(m) { st.market = m; if (!document.querySelector('#trading').hidden) hud.renderTrading(); },
    setSignals(s) { st.signals = s; st.signalsAt = Date.now(); const sig = document.querySelector('#trading #panel-signals'); if (sig) sig.innerHTML = signalsHtml(s, { mobile }); },
    state: st,
  };
}
