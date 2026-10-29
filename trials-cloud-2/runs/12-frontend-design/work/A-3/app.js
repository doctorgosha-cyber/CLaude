(() => {
  'use strict';

  const MAX_COMPARE = 3;

  const list = document.getElementById('product-list');
  const empty = document.getElementById('empty-results');
  const status = document.getElementById('results-status');
  const bar = document.getElementById('compare-bar');
  const countEl = document.getElementById('compare-count');
  const namesEl = document.getElementById('compare-names');
  const clearBtn = document.getElementById('compare-clear');
  const speciesEl = document.getElementById('filter-species');
  const minEl = document.getElementById('filter-price-min');
  const maxEl = document.getElementById('filter-price-max');
  const sortEl = document.getElementById('sort-select');

  const state = {
    currency: { symbol: '' },
    products: [],
    selected: new Set(),
    cards: new Map(),
  };

  const byName = (a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
    a.name.localeCompare(b.name, 'en');

  const sorters = {
    featured: (a, b) => a.index - b.index,
    'price-asc': (a, b) => a.price - b.price || byName(a, b),
    'price-desc': (a, b) => b.price - a.price || byName(a, b),
    'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
    'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
  };

  const formatPrice = (n) => `${state.currency.symbol}${n.toFixed(2)}`;

  function parseBound(input) {
    const raw = input.value.trim();
    if (raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const child of children) node.append(child);
    return node;
  }

  function buildCard(p) {
    const toggle = el('button', {
      type: 'button',
      class: 'btn',
      'data-testid': 'compare-toggle',
      'aria-pressed': 'false',
      'aria-label': `Compare ${p.name}`,
      text: 'Compare',
    });
    toggle.addEventListener('click', () => toggleCompare(p.id));

    const media = el('div', { class: 'card__media' }, [
      el('img', { src: p.image, alt: '', width: 320, height: 240, loading: 'lazy', decoding: 'async' }),
    ]);
    if (p.badge) media.append(el('span', { class: 'card__badge', text: p.badge }));

    const card = el('li', {
      class: 'card',
      'data-testid': 'product-card',
      'data-product-id': p.id,
    }, [
      media,
      el('div', { class: 'card__body' }, [
        el('div', {}, [
          el('p', { class: 'card__brand', text: p.brand }),
          el('h2', { class: 'card__name', text: p.name }),
        ]),
        el('div', { class: 'card__topline' }, [
          el('span', { class: 'card__price', 'data-testid': 'product-price', text: formatPrice(p.price) }),
          el('span', { class: 'card__rating' }, [
            el('span', { class: 'card__star', 'aria-hidden': 'true', text: '★' }),
            el('span', { 'data-testid': 'product-rating', text: `${p.rating.toFixed(1)} out of 5` }),
          ]),
        ]),
        el('dl', { class: 'card__specs' }, [
          el('div', {}, [el('dt', { text: 'Energy' }), el('dd', { text: `${Math.round(p.kcalPer100g)} kcal / 100 g` })]),
          el('div', {}, [el('dt', { text: 'Protein' }), el('dd', { text: `${Math.round(p.proteinPct)} %` })]),
        ]),
        el('p', { class: 'card__species', text: `For ${p.species}s` }),
        toggle,
      ]),
    ]);

    state.cards.set(p.id, { card, toggle });
    return card;
  }

  function render() {
    const species = speciesEl.value;
    const min = parseBound(minEl);
    const max = parseBound(maxEl);
    const sorter = sorters[sortEl.value] || sorters.featured;

    const visible = state.products
      .filter((p) => (species === 'all' || p.species === species) &&
        (min === null || p.price >= min) &&
        (max === null || p.price <= max))
      .sort(sorter);

    // Re-order the DOM to match; hide what is filtered out.
    const visibleIds = new Set(visible.map((p) => p.id));
    for (const [id, { card }] of state.cards) card.hidden = !visibleIds.has(id);
    for (const p of visible) list.append(state.cards.get(p.id).card);

    empty.hidden = visible.length > 0;
    status.textContent = visible.length === 0
      ? 'No foods shown.'
      : `Showing ${visible.length} of ${state.products.length} foods.`;
  }

  function toggleCompare(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else if (state.selected.size < MAX_COMPARE) state.selected.add(id);
    renderCompare();
  }

  function renderCompare() {
    const full = state.selected.size >= MAX_COMPARE;
    for (const [id, { card, toggle }] of state.cards) {
      const on = state.selected.has(id);
      toggle.setAttribute('aria-pressed', String(on));
      toggle.textContent = on ? 'Selected' : 'Compare';
      toggle.disabled = full && !on;
      card.classList.toggle('is-selected', on);
    }

    countEl.textContent = String(state.selected.size);
    namesEl.replaceChildren(
      ...state.products
        .filter((p) => state.selected.has(p.id))
        .map((p) => el('li', { text: p.name })),
    );
    bar.hidden = state.selected.size === 0;
  }

  function clearCompare() {
    state.selected.clear();
    renderCompare();
  }

  async function init() {
    try {
      const res = await fetch('data/products.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.currency = data.currency || { symbol: '' };
      state.products = (data.products || []).map((p, index) => ({ ...p, index }));
    } catch (err) {
      status.textContent = 'Sorry, the product list could not be loaded.';
      return;
    }

    list.replaceChildren(...state.products.map(buildCard));

    for (const control of [speciesEl, minEl, maxEl, sortEl]) {
      control.addEventListener('input', render);
      control.addEventListener('change', render);
    }
    clearBtn.addEventListener('click', clearCompare);

    render();
    renderCompare();
  }

  init();
})();
