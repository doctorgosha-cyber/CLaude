// Kibble & Co. comparison section: filter, sort and pick up to three foods.
(() => {
  const MAX_COMPARE = 3;

  const el = {
    species: document.getElementById('filter-species'),
    min: document.getElementById('filter-price-min'),
    max: document.getElementById('filter-price-max'),
    sort: document.getElementById('sort-select'),
    cards: document.getElementById('cards'),
    count: document.getElementById('results-count'),
    empty: document.getElementById('empty-results'),
    reset: document.getElementById('reset-filters'),
    bar: document.getElementById('compare-bar'),
    barCount: document.getElementById('compare-count'),
    barOf: document.getElementById('compare-of'),
    barNames: document.getElementById('compare-names'),
    clear: document.getElementById('compare-clear'),
  };

  let currency = { code: 'GBP', symbol: '£' };
  let products = [];
  const cardById = new Map();
  const selected = []; // product ids, in the order they were picked

  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const sorters = {
    'featured': (a, b) => a.index - b.index,
    'price-asc': (a, b) => a.price - b.price || byName(a, b),
    'price-desc': (a, b) => b.price - a.price || byName(a, b),
    'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
    'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
  };

  const formatPrice = (n) => `${currency.symbol}${n.toFixed(2)}`;
  const formatRating = (n) => n.toFixed(1);

  function parseBound(input) {
    const v = input.value.trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function buildCard(p) {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.testid = 'product-card';
    li.dataset.productId = p.id;

    const figure = document.createElement('figure');
    figure.className = 'card__figure';
    const img = document.createElement('img');
    img.className = 'card__image';
    img.src = p.image;
    img.alt = '';
    img.width = 320;
    img.height = 240;
    img.decoding = 'async';
    figure.append(img);
    if (p.badge) {
      const badge = document.createElement('span');
      badge.className = 'card__badge';
      badge.textContent = p.badge;
      figure.append(badge);
    }
    const slot = document.createElement('span');
    slot.className = 'card__slot';
    slot.hidden = true;
    slot.setAttribute('aria-hidden', 'true');
    figure.append(slot);

    const body = document.createElement('div');
    body.className = 'card__body';

    const brand = document.createElement('p');
    brand.className = 'card__brand';
    brand.textContent = p.brand;

    const name = document.createElement('h2');
    name.className = 'card__name';
    name.id = `name-${p.id}`;
    name.textContent = p.name;

    const price = document.createElement('p');
    price.className = 'card__price';
    price.dataset.testid = 'product-price';
    price.textContent = formatPrice(p.price);

    const dl = document.createElement('dl');
    dl.className = 'analysis';
    const rows = [
      ['Crude protein', `${Math.round(p.proteinPct)}%`],
      ['Energy', `${Math.round(p.kcalPer100g)} kcal per 100 g`],
      ['Our rating', `${formatRating(p.rating)} out of 5`, 'product-rating'],
    ];
    for (const [label, value, testid] of rows) {
      const row = document.createElement('div');
      row.className = 'analysis__row';
      const dt = document.createElement('dt');
      dt.textContent = label;
      const leader = document.createElement('span');
      leader.className = 'analysis__leader';
      leader.setAttribute('aria-hidden', 'true');
      const dd = document.createElement('dd');
      dd.textContent = value;
      if (testid) dd.dataset.testid = testid;
      row.append(dt, leader, dd);
      dl.append(row);
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'button compare-toggle';
    toggle.dataset.testid = 'compare-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-describedby', name.id);
    toggle.textContent = 'Add to comparison';
    toggle.addEventListener('click', () => toggleSelect(p.id));

    body.append(brand, name, price, dl, toggle);
    li.append(figure, body);
    return { li, toggle, slot };
  }

  function visibleProducts() {
    const species = el.species.value;
    const min = parseBound(el.min);
    const max = parseBound(el.max);
    const list = products.filter((p) =>
      (species === 'all' || p.species === species) &&
      (min === null || p.price >= min) &&
      (max === null || p.price <= max));
    const sorter = sorters[el.sort.value] || sorters.featured;
    return list.slice().sort(sorter);
  }

  function render() {
    const shown = visibleProducts();
    const shownIds = new Set(shown.map((p) => p.id));
    for (const p of products) cardById.get(p.id).li.hidden = !shownIds.has(p.id);
    for (const p of shown) el.cards.append(cardById.get(p.id).li); // re-append = reorder
    el.empty.hidden = shown.length > 0;
    el.count.textContent = shown.length === products.length
      ? `Showing all ${products.length} foods`
      : `Showing ${shown.length} of ${products.length} foods`;
  }

  function renderSelection() {
    const full = selected.length >= MAX_COMPARE;
    for (const p of products) {
      const { li, toggle, slot } = cardById.get(p.id);
      const position = selected.indexOf(p.id);
      const on = position !== -1;
      li.classList.toggle('card--selected', on);
      toggle.setAttribute('aria-pressed', String(on));
      toggle.textContent = on ? 'Remove from comparison' : 'Add to comparison';
      slot.hidden = !on;
      slot.textContent = on ? String(position + 1) : '';
      if (!on && full) toggle.setAttribute('disabled', '');
      else toggle.removeAttribute('disabled');
    }
    el.barCount.textContent = String(selected.length);
    el.barOf.textContent = ` of ${MAX_COMPARE} foods picked`;
    el.barNames.textContent = selected
      .map((id) => products.find((p) => p.id === id).name)
      .join(', ');
    el.bar.hidden = selected.length === 0;
    document.body.classList.toggle('has-selection', selected.length > 0);
  }

  function toggleSelect(id) {
    const i = selected.indexOf(id);
    if (i !== -1) selected.splice(i, 1);
    else if (selected.length < MAX_COMPARE) selected.push(id);
    renderSelection();
  }

  function clearSelection() {
    selected.length = 0;
    renderSelection();
    const first = products.find((p) => !cardById.get(p.id).li.hidden);
    if (first) cardById.get(first.id).toggle.focus();
  }

  function resetFilters() {
    el.species.value = 'all';
    el.min.value = '';
    el.max.value = '';
    render();
    el.species.focus();
  }

  async function init() {
    try {
      const res = await fetch('data/products.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      currency = data.currency || currency;
      products = data.products.map((p, index) => ({ ...p, index }));
    } catch (err) {
      el.count.textContent = 'The list of foods could not be loaded. Reload the page to try again.';
      return;
    }

    for (const node of document.querySelectorAll('[data-currency-label]')) node.textContent = `(${currency.symbol})`;

    for (const p of products) {
      const card = buildCard(p);
      cardById.set(p.id, card);
      el.cards.append(card.li);
    }

    el.species.addEventListener('change', render);
    el.sort.addEventListener('change', render);
    el.min.addEventListener('input', render);
    el.max.addEventListener('input', render);
    el.reset.addEventListener('click', resetFilters);
    el.clear.addEventListener('click', clearSelection);
    for (const input of [el.min, el.max]) {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    }

    render();
    renderSelection();
  }

  init();
})();
