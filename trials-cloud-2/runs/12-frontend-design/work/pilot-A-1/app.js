'use strict';

const MAX_COMPARE = 3;

const state = {
  currency: { symbol: '' },
  products: [],
  species: 'all',
  priceMin: null,
  priceMax: null,
  sort: 'featured',
  selected: new Set(),
};

const $ = (sel) => document.querySelector(sel);
const els = {
  list: $('#product-list'),
  empty: $('#empty-results'),
  status: $('#results-status'),
  species: $('#filter-species'),
  priceMin: $('#filter-price-min'),
  priceMax: $('#filter-price-max'),
  sort: $('#sort-select'),
  form: $('#toolbar'),
  bar: $('#compare-bar'),
  count: $('#compare-count'),
  names: $('#compare-names'),
  clear: $('#compare-clear'),
};

const fmtPrice = (n) => `${state.currency.symbol}${n.toFixed(2)}`;
const fmtRating = (n) => n.toFixed(1);
const byName = (a, b) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

const sorters = {
  featured: (a, b) => a.index - b.index,
  'price-asc': (a, b) => a.price - b.price || byName(a, b),
  'price-desc': (a, b) => b.price - a.price || byName(a, b),
  'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
  'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
};

function parseBound(input) {
  const raw = input.value.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function visibleProducts() {
  const out = state.products.filter((p) => {
    if (state.species !== 'all' && p.species !== state.species) return false;
    if (state.priceMin !== null && p.price < state.priceMin) return false;
    if (state.priceMax !== null && p.price > state.priceMax) return false;
    return true;
  });
  return out.sort(sorters[state.sort] || sorters.featured);
}

function buildCard(p) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.testid = 'product-card';
  li.dataset.productId = p.id;

  const media = document.createElement('div');
  media.className = 'card__media';
  const img = document.createElement('img');
  img.src = p.image;
  img.alt = '';
  img.width = 320;
  img.height = 240;
  img.loading = 'lazy';
  img.decoding = 'async';
  media.append(img);
  if (p.badge) {
    const badge = document.createElement('span');
    badge.className = 'card__badge';
    badge.textContent = p.badge;
    media.append(badge);
  }

  const body = document.createElement('div');
  body.className = 'card__body';

  const brand = document.createElement('p');
  brand.className = 'card__brand';
  brand.textContent = p.brand;

  const name = document.createElement('h2');
  name.className = 'card__name';
  name.id = `name-${p.id}`;
  name.textContent = p.name;

  const row = document.createElement('div');
  row.className = 'card__row';
  const price = document.createElement('span');
  price.className = 'card__price';
  price.dataset.testid = 'product-price';
  price.textContent = fmtPrice(p.price);
  const ratingWrap = document.createElement('span');
  ratingWrap.className = 'card__rating';
  const star = document.createElement('span');
  star.className = 'card__star';
  star.setAttribute('aria-hidden', 'true');
  star.textContent = '★';
  const rating = document.createElement('span');
  rating.dataset.testid = 'product-rating';
  rating.textContent = `${fmtRating(p.rating)} out of 5`;
  ratingWrap.append(star, rating);
  row.append(price, ratingWrap);

  const stats = document.createElement('dl');
  stats.className = 'card__stats';
  for (const [label, value] of [
    ['Energy', `${p.kcalPer100g} kcal/100 g`],
    ['Protein', `${p.proteinPct}% protein`],
  ]) {
    const wrap = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrap.append(dt, dd);
    stats.append(wrap);
  }

  const species = document.createElement('p');
  species.className = 'card__species';
  species.textContent = p.species === 'dog' ? 'For dogs' : 'For cats';

  const action = document.createElement('div');
  action.className = 'card__action';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn';
  btn.dataset.testid = 'compare-toggle';
  btn.dataset.productId = p.id;
  btn.setAttribute('aria-pressed', 'false');
  btn.setAttribute('aria-describedby', name.id);
  btn.addEventListener('click', () => toggleCompare(p.id));
  action.append(btn);

  body.append(brand, name, row, stats, species, action);
  li.append(media, body);
  p.el = li;
  p.btn = btn;
  return li;
}

function syncCompareUI() {
  const n = state.selected.size;
  const full = n >= MAX_COMPARE;
  for (const p of state.products) {
    const on = state.selected.has(p.id);
    p.el.classList.toggle('is-selected', on);
    p.btn.setAttribute('aria-pressed', String(on));
    p.btn.disabled = !on && full;
    p.btn.textContent = '';
    const icon = document.createElement('span');
    icon.className = 'btn__check';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = on ? '✓' : '+';
    p.btn.append(icon, document.createTextNode(on ? ' Added to compare' : ' Compare'));
  }
  els.count.textContent = String(n);
  els.names.textContent = '';
  for (const p of state.products) {
    if (!state.selected.has(p.id)) continue;
    const li = document.createElement('li');
    li.textContent = p.name;
    els.names.append(li);
  }
  els.bar.hidden = n === 0;
  document.body.classList.toggle('has-compare-bar', n > 0);
}

function toggleCompare(id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < MAX_COMPARE) state.selected.add(id);
  else return;
  syncCompareUI();
}

function render() {
  const shown = visibleProducts();
  els.list.textContent = '';
  for (const p of shown) els.list.append(p.el);
  els.empty.hidden = shown.length > 0;
  els.status.textContent =
    shown.length === 0
      ? 'Showing 0 foods'
      : `Showing ${shown.length} of ${state.products.length} foods`;
}

function readControls() {
  state.species = els.species.value;
  state.priceMin = parseBound(els.priceMin);
  state.priceMax = parseBound(els.priceMax);
  state.sort = els.sort.value;
  render();
}

function wire() {
  els.form.addEventListener('submit', (e) => e.preventDefault());
  els.species.addEventListener('change', readControls);
  els.sort.addEventListener('change', readControls);
  els.priceMin.addEventListener('input', readControls);
  els.priceMax.addEventListener('input', readControls);
  els.clear.addEventListener('click', () => {
    state.selected.clear();
    syncCompareUI();
  });
}

async function init() {
  wire();
  try {
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.currency = data.currency || { symbol: '' };
    state.products = data.products.map((p, index) => ({ ...p, index }));
  } catch (err) {
    els.status.textContent = 'Sorry, the product list could not be loaded.';
    return;
  }
  for (const el of document.querySelectorAll('[data-currency]')) {
    el.textContent = `(${state.currency.symbol})`;
  }
  for (const p of state.products) buildCard(p);
  syncCompareUI();
  readControls();
}

init();
