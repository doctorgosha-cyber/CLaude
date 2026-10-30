'use strict';

const MAX_COMPARE = 3;

const state = {
  symbol: '£',
  products: [],
  selected: new Set(),
  species: 'all',
  priceMin: null,
  priceMax: null,
  sort: 'featured',
};

const el = {
  species: document.getElementById('filter-species'),
  priceMin: document.getElementById('filter-price-min'),
  priceMax: document.getElementById('filter-price-max'),
  sort: document.getElementById('sort-select'),
  form: document.getElementById('filters'),
  cards: document.getElementById('cards'),
  empty: document.getElementById('empty-results'),
  status: document.getElementById('result-status'),
  bar: document.getElementById('compare-bar'),
  slots: document.getElementById('tray-slots'),
  count: document.getElementById('compare-count'),
  clear: document.getElementById('compare-clear'),
  symbols: [document.getElementById('symbol-min'), document.getElementById('symbol-max')],
};

const formatPrice = (n) => `${state.symbol}${n.toFixed(2)}`;
const formatRating = (n) => n.toFixed(1);
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

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

function readFilters() {
  state.species = el.species.value;
  state.priceMin = parseBound(el.priceMin);
  state.priceMax = parseBound(el.priceMax);
  state.sort = sorters[el.sort.value] ? el.sort.value : 'featured';
}

function visibleProducts() {
  return state.products
    .filter((p) => state.species === 'all' || p.species === state.species)
    .filter((p) => state.priceMin === null || p.price >= state.priceMin)
    .filter((p) => state.priceMax === null || p.price <= state.priceMax)
    .sort(sorters[state.sort]);
}

function buildCard(p) {
  const li = document.createElement('li');
  li.className = 'card';
  li.dataset.testid = 'product-card';
  li.dataset.productId = p.id;

  const figure = document.createElement('div');
  figure.className = 'card-figure';
  const img = document.createElement('img');
  img.src = p.image;
  img.alt = '';
  img.width = 320;
  img.height = 240;
  img.decoding = 'async';
  figure.append(img);
  if (p.badge) {
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = p.badge;
    figure.append(badge);
  }

  const heading = document.createElement('h2');
  heading.className = 'card-name';
  heading.id = `name-${p.id}`;
  heading.textContent = p.name;

  const brand = document.createElement('p');
  brand.className = 'card-brand';
  brand.textContent = `${p.brand}, for ${p.species === 'dog' ? 'dogs' : 'cats'}`;

  const panel = document.createElement('dl');
  panel.className = 'panel';
  const rows = [
    ['Price', formatPrice(p.price), 'product-price'],
    ['Energy', `${Math.round(p.kcalPer100g)} kcal per 100 g`],
    ['Protein', `${Math.round(p.proteinPct)}%`],
    ['Rating', `${formatRating(p.rating)} out of 5`, 'product-rating'],
  ];
  for (const [term, value, testid] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    if (testid) dd.dataset.testid = testid;
    panel.append(dt, dd);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'card-toggle';
  toggle.dataset.testid = 'compare-toggle';
  toggle.dataset.productId = p.id;
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-describedby', heading.id);
  toggle.textContent = 'Compare';

  li.append(figure, heading, brand, panel, toggle);
  return li;
}

function renderCards() {
  const list = visibleProducts();
  el.cards.replaceChildren(...list.map((p) => p.node));
  const none = list.length === 0;
  el.empty.hidden = !none;
  el.status.textContent = none
    ? 'No foods match.'
    : `Showing ${list.length} of ${state.products.length} foods.`;
  syncToggles();
}

function syncToggles() {
  const full = state.selected.size >= MAX_COMPARE;
  for (const p of state.products) {
    const on = state.selected.has(p.id);
    p.node.classList.toggle('is-chosen', on);
    p.toggle.setAttribute('aria-pressed', String(on));
    p.toggle.disabled = full && !on;
  }
  renderTray();
}

function renderTray() {
  const chosen = state.products.filter((p) => state.selected.has(p.id));
  el.bar.hidden = chosen.length === 0;
  el.count.textContent = String(chosen.length);
  const slots = el.slots.children;
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const p = chosen[i];
    slot.classList.toggle('is-filled', Boolean(p));
    if (p) {
      let img = slot.firstElementChild;
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        img.width = 64;
        img.height = 48;
        slot.append(img);
      }
      if (img.getAttribute('src') !== p.image) img.src = p.image;
    } else {
      slot.replaceChildren();
    }
  }
}

function toggleCompare(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else if (state.selected.size < MAX_COMPARE) {
    state.selected.add(id);
  }
  syncToggles();
}

function wireEvents() {
  el.form.addEventListener('submit', (e) => e.preventDefault());
  el.form.addEventListener('input', () => { readFilters(); renderCards(); });
  el.form.addEventListener('change', () => { readFilters(); renderCards(); });
  el.cards.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-testid="compare-toggle"]');
    if (btn && !btn.disabled) toggleCompare(btn.dataset.productId);
  });
  el.clear.addEventListener('click', () => {
    state.selected.clear();
    syncToggles();
  });
}

async function init() {
  wireEvents();
  try {
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.symbol = (data.currency && data.currency.symbol) || state.symbol;
    for (const s of el.symbols) s.textContent = state.symbol;
    state.products = data.products.map((p, index) => {
      const node = buildCard(p);
      return { ...p, index, node, toggle: node.querySelector('[data-testid="compare-toggle"]') };
    });
    readFilters();
    renderCards();
  } catch (err) {
    el.status.textContent = 'The food list could not be loaded. Reload the page to try again.';
    el.empty.hidden = true;
  }
}

init();
