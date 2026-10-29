'use strict';

const MAX_COMPARE = 3;

const state = {
  products: [],
  symbol: '',
  selected: new Set(),
  species: 'all',
  priceMin: null,
  priceMax: null,
  sort: 'featured',
};

const $ = (sel) => document.querySelector(sel);
const els = {
  section: $('[data-testid="comparison-section"]'),
  form: $('.toolbar'),
  species: $('[data-testid="filter-species"]'),
  priceMin: $('[data-testid="filter-price-min"]'),
  priceMax: $('[data-testid="filter-price-max"]'),
  sort: $('[data-testid="sort-select"]'),
  status: $('#results-status'),
  list: $('#cards'),
  empty: $('[data-testid="empty-results"]'),
  bar: $('[data-testid="compare-bar"]'),
  count: $('[data-testid="compare-count"]'),
  chips: $('#compare-chips'),
  clear: $('[data-testid="compare-clear"]'),
  currencyHint: $('#currency-hint'),
};

/** id -> { li, toggle } */
const cards = new Map();

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const sorters = {
  featured: (a, b) => a.index - b.index,
  'price-asc': (a, b) => a.price - b.price || byName(a, b),
  'price-desc': (a, b) => b.price - a.price || byName(a, b),
  'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
  'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
};

const formatPrice = (n) => `${state.symbol}${n.toFixed(2)}`;
const formatRating = (n) => n.toFixed(1);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children) node.append(child);
  return node;
}

function stat(label, value, testid) {
  const dd = el('dd', { text: value });
  if (testid) dd.dataset.testid = testid;
  return el('div', { class: 'stat' }, [el('dt', { text: label }), dd]);
}

function buildCard(p) {
  const toggle = el('button', {
    type: 'button',
    class: 'btn btn--toggle compare-toggle',
    'aria-pressed': 'false',
    'data-testid': 'compare-toggle',
    'data-id': p.id,
  }, [
    el('span', { class: 'compare-toggle__icon', 'aria-hidden': 'true' }),
    el('span', { text: 'Compare' }),
    el('span', { class: 'visually-hidden', text: ` ${p.name}` }),
  ]);

  const stats = el('dl', { class: 'stats' }, [
    stat('Price', formatPrice(p.price), 'product-price'),
    stat('Per 100 g', `${p.kcalPer100g} kcal`),
    stat('Protein', `${p.proteinPct}%`),
  ]);

  const rating = el('p', { class: 'rating' }, [
    el('span', { class: 'rating__star', 'aria-hidden': 'true', text: '★' }),
    el('span', { 'data-testid': 'product-rating', text: `${formatRating(p.rating)} out of 5` }),
  ]);

  const media = el('div', { class: 'card__media' }, [
    el('img', { src: p.image, alt: '', width: '320', height: '240', loading: 'lazy', decoding: 'async' }),
  ]);
  if (p.badge) media.append(el('span', { class: 'badge', text: p.badge }));

  const li = el('li', {
    class: 'card',
    'data-testid': 'product-card',
    'data-product-id': p.id,
    'data-species': p.species,
  }, [
    media,
    el('div', { class: 'card__body' }, [
      el('p', { class: 'card__brand', text: p.brand }),
      el('h2', { class: 'card__name', text: p.name }),
      el('p', { class: 'card__species', text: p.species === 'dog' ? 'For dogs' : 'For cats' }),
      rating,
      stats,
      toggle,
    ]),
  ]);

  cards.set(p.id, { li, toggle });
  return li;
}

function parseBound(input) {
  const raw = input.value.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readFilters() {
  state.species = els.species.value;
  state.priceMin = parseBound(els.priceMin);
  state.priceMax = parseBound(els.priceMax);
  state.sort = sorters[els.sort.value] ? els.sort.value : 'featured';
}

function matches(p) {
  if (state.species !== 'all' && p.species !== state.species) return false;
  if (state.priceMin !== null && p.price < state.priceMin) return false;
  if (state.priceMax !== null && p.price > state.priceMax) return false;
  return true;
}

function render() {
  const ordered = [...state.products].sort(sorters[state.sort]);
  let shown = 0;
  const frag = document.createDocumentFragment();
  for (const p of ordered) {
    const { li } = cards.get(p.id);
    const visible = matches(p);
    li.hidden = !visible;
    if (visible) shown += 1;
    frag.append(li);
  }
  els.list.append(frag);

  const total = state.products.length;
  els.empty.hidden = shown > 0;
  els.status.textContent = shown === 0
    ? 'No foods match these filters.'
    : `Showing ${shown} of ${total} foods`;
}

function renderCompare() {
  const n = state.selected.size;
  const full = n >= MAX_COMPARE;

  for (const [id, { toggle }] of cards) {
    const on = state.selected.has(id);
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.disabled = !on && full;
  }

  els.count.textContent = String(n);
  els.bar.hidden = n === 0;
  els.section.classList.toggle('has-compare', n > 0);

  els.chips.replaceChildren(...state.products
    .filter((p) => state.selected.has(p.id))
    .map((p) => el('li', { class: 'chip' }, [
      el('span', { text: p.name }),
      el('button', {
        type: 'button',
        class: 'chip__remove',
        'data-remove': p.id,
        'aria-label': `Remove ${p.name} from comparison`,
      }, [el('span', { 'aria-hidden': 'true', text: '×' })]),
    ])));
}

function toggleSelection(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < MAX_COMPARE) state.selected.add(id);
  renderCompare();
}

function focusFirstToggle() {
  const first = [...cards.values()].find(({ li }) => !li.hidden);
  (first ? first.toggle : els.species).focus();
}

function bind() {
  els.form.addEventListener('submit', (e) => e.preventDefault());
  els.form.addEventListener('input', () => { readFilters(); render(); });
  els.form.addEventListener('change', () => { readFilters(); render(); });

  els.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-testid="compare-toggle"]');
    if (btn && !btn.disabled) toggleSelection(btn.dataset.id);
  });

  els.chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const id = btn.dataset.remove;
    state.selected.delete(id);
    renderCompare();
    const card = cards.get(id);
    (card && !card.li.hidden ? card.toggle : (els.bar.hidden ? null : els.clear) || els.species).focus();
  });

  els.clear.addEventListener('click', () => {
    state.selected.clear();
    renderCompare();
    focusFirstToggle();
  });
}

async function init() {
  bind();
  try {
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.symbol = (data.currency && data.currency.symbol) || '';
    state.products = data.products.map((p, index) => ({ ...p, index }));
    els.currencyHint.textContent = state.symbol ? `(${state.symbol})` : '';
    els.list.replaceChildren(...state.products.map(buildCard));
    readFilters();
    render();
    renderCompare();
  } catch (err) {
    els.status.textContent = 'Sorry, the foods could not be loaded. Please refresh to try again.';
    console.error(err);
  }
}

init();
