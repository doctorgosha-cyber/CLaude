// Kibble & Co. — product comparison section
// Plain ES2020, no dependencies. Data comes from data/products.json.

const MAX_COMPARE = 3;

const SORTERS = {
  'featured': (a, b) => a.index - b.index,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  'rating-desc': (a, b) => b.rating - a.rating,
  'protein-desc': (a, b) => b.proteinPct - a.proteinPct,
};

const SPECIES_LABEL = { dog: 'Dog food', cat: 'Cat food' };

const state = {
  currency: { symbol: '£' },
  products: [],
  selected: new Set(),
  cards: new Map(), // id -> { li, toggle }
};

const $ = (id) => document.getElementById(id);
const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  Object.assign(els, {
    species: $('filter-species'),
    min: $('filter-price-min'),
    max: $('filter-price-max'),
    sort: $('sort-select'),
    list: $('product-list'),
    empty: $('empty-results'),
    error: $('load-error'),
    summary: $('results-summary'),
    bar: $('compare-bar'),
    count: $('compare-count'),
    label: $('compare-label'),
    chips: $('compare-chips'),
    clear: $('compare-clear'),
  });

  try {
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.currency = data.currency || state.currency;
    state.products = (data.products || []).map((p, index) => ({ ...p, index }));
  } catch (err) {
    els.error.hidden = false;
    return;
  }

  document.querySelectorAll('[data-currency-symbol]').forEach((el) => {
    el.textContent = state.currency.symbol;
  });

  buildCards();
  bindControls();
  render();
  renderCompareBar();
}

/* ---------- Card construction (built once; filtering only hides/reorders) ---------- */

function formatPrice(n) {
  return `${state.currency.symbol}${n.toFixed(2)}`;
}

function buildCards() {
  const frag = document.createDocumentFragment();
  for (const p of state.products) {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.testid = 'product-card';
    li.dataset.productId = p.id;
    li.dataset.species = p.species;

    const media = document.createElement('div');
    media.className = 'card__media';
    const img = document.createElement('img');
    img.src = p.image;
    img.alt = '';
    img.width = 320;
    img.height = 240;
    img.loading = 'lazy';
    img.decoding = 'async';
    media.appendChild(img);
    if (p.badge) {
      const badge = document.createElement('span');
      badge.className = 'card__badge';
      badge.textContent = p.badge;
      media.appendChild(badge);
    }

    const body = document.createElement('div');
    body.className = 'card__body';

    const meta = document.createElement('p');
    meta.className = 'card__meta';
    const brand = document.createElement('span');
    brand.className = 'card__brand';
    brand.textContent = p.brand;
    const species = document.createElement('span');
    species.className = `card__species card__species--${p.species}`;
    species.textContent = SPECIES_LABEL[p.species] || p.species;
    meta.append(brand, species);

    const name = document.createElement('h2');
    name.className = 'card__name';
    name.id = `name-${p.id}`;
    name.textContent = p.name;

    const priceRow = document.createElement('p');
    priceRow.className = 'card__price-row';
    const price = document.createElement('span');
    price.className = 'card__price';
    price.dataset.testid = 'product-price';
    price.textContent = formatPrice(p.price);
    const per = document.createElement('span');
    per.className = 'card__per';
    per.textContent = 'per bag';
    priceRow.append(price, per);

    const rating = document.createElement('p');
    rating.className = 'card__rating';
    const stars = document.createElement('span');
    stars.className = 'card__stars';
    stars.setAttribute('aria-hidden', 'true');
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      const fill = p.rating >= i ? 'full' : p.rating >= i - 0.5 ? 'half' : 'empty';
      star.className = `star star--${fill}`;
      star.textContent = '★';
      stars.appendChild(star);
    }
    const ratingText = document.createElement('span');
    ratingText.className = 'card__rating-text';
    ratingText.dataset.testid = 'product-rating';
    ratingText.textContent = `${p.rating.toFixed(1)} out of 5`;
    rating.append(stars, ratingText);

    const facts = document.createElement('dl');
    facts.className = 'card__facts';
    facts.append(
      fact('Energy', `${Math.round(p.kcalPer100g)} kcal`, 'per 100 g'),
      fact('Protein', `${Math.round(p.proteinPct)}%`, 'crude protein'),
    );

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn card__toggle';
    toggle.dataset.testid = 'compare-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-label', `Compare ${p.name}`);
    toggle.innerHTML = '<span class="card__toggle-mark" aria-hidden="true"></span><span class="card__toggle-text">Compare</span>';
    toggle.addEventListener('click', () => toggleCompare(p.id));

    body.append(meta, name, priceRow, rating, facts, toggle);
    li.append(media, body);
    frag.appendChild(li);
    state.cards.set(p.id, { li, toggle, product: p });
  }
  els.list.appendChild(frag);
}

function fact(label, value, note) {
  const wrap = document.createElement('div');
  wrap.className = 'fact';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  const strong = document.createElement('strong');
  strong.textContent = value;
  const small = document.createElement('small');
  small.textContent = note;
  dd.append(strong, ' ', small);
  wrap.append(dt, dd);
  return wrap;
}

/* ---------- Filtering & sorting ---------- */

function bindControls() {
  els.species.addEventListener('change', render);
  els.sort.addEventListener('change', render);
  for (const input of [els.min, els.max]) {
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  }
  els.clear.addEventListener('click', clearCompare);
}

function parseBound(input) {
  const raw = input.value.trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function visibleProducts() {
  const species = els.species.value;
  const min = parseBound(els.min);
  const max = parseBound(els.max);
  const sorter = SORTERS[els.sort.value] || SORTERS.featured;

  const matches = state.products.filter((p) =>
    (species === 'all' || p.species === species) &&
    (min === null || p.price >= min) &&
    (max === null || p.price <= max));

  return matches.sort((a, b) => {
    const diff = sorter(a, b);
    if (diff !== 0) return diff;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en');
  });
}

function render() {
  const shown = visibleProducts();
  const shownIds = new Set(shown.map((p) => p.id));

  // Reorder visible cards in place, hide the rest. Nodes are reused so compare state stays put.
  for (const p of shown) {
    const { li } = state.cards.get(p.id);
    li.hidden = false;
    els.list.appendChild(li);
  }
  for (const [id, { li }] of state.cards) {
    if (!shownIds.has(id)) li.hidden = true;
  }

  els.empty.hidden = shown.length > 0;
  els.list.hidden = shown.length === 0;
  const total = state.products.length;
  els.summary.textContent = shown.length === total
    ? `Showing all ${total} foods`
    : `Showing ${shown.length} of ${total} foods`;
}

/* ---------- Compare ---------- */

function toggleCompare(id) {
  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else if (state.selected.size < MAX_COMPARE) {
    state.selected.add(id);
  } else {
    return;
  }
  renderCompareBar();
}

function clearCompare() {
  state.selected.clear();
  renderCompareBar();
  // Hand focus back to something sensible once the bar disappears.
  const firstVisible = [...state.cards.values()].find(({ li }) => !li.hidden);
  if (firstVisible) firstVisible.toggle.focus();
}

function renderCompareBar() {
  const n = state.selected.size;
  const full = n >= MAX_COMPARE;

  for (const [id, { li, toggle }] of state.cards) {
    const on = state.selected.has(id);
    toggle.setAttribute('aria-pressed', String(on));
    toggle.querySelector('.card__toggle-text').textContent = on ? 'Comparing' : 'Compare';
    li.classList.toggle('card--selected', on);
    if (full && !on) toggle.setAttribute('disabled', '');
    else toggle.removeAttribute('disabled');
  }

  els.count.textContent = String(n);
  els.label.textContent = full
    ? `of ${MAX_COMPARE} selected — that's the limit`
    : `of ${MAX_COMPARE} selected to compare`;

  els.chips.replaceChildren(...[...state.selected].map((id) => {
    const chip = document.createElement('li');
    chip.className = 'chip';
    chip.textContent = state.cards.get(id).product.name;
    return chip;
  }));

  els.bar.hidden = n === 0;
  document.body.classList.toggle('has-compare-bar', n > 0);
}
