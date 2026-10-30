// Kibble & Co. comparison section
(() => {
  const MAX_PICKS = 3;
  const section = document.querySelector('[data-testid="comparison-section"]');
  const list = document.getElementById('cards');
  const empty = document.getElementById('empty-results');
  const resultCount = document.getElementById('result-count');
  const speciesSelect = document.getElementById('filter-species');
  const minInput = document.getElementById('filter-price-min');
  const maxInput = document.getElementById('filter-price-max');
  const sortSelect = document.getElementById('sort-select');
  const bar = document.getElementById('compare-bar');
  const countEl = document.getElementById('compare-count');
  const slots = Array.from(document.querySelectorAll('.slot'));
  const clearButton = document.getElementById('compare-clear');
  const form = section.querySelector('form');

  let products = [];
  let symbol = '';
  const cards = new Map();   // id -> { li, toggle }
  const picked = [];         // ordered ids, max 3

  const money = (n) => `${symbol}${n.toFixed(2)}`;
  const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en');
  const sorters = {
    featured: (a, b) => a.index - b.index,
    'price-asc': (a, b) => a.price - b.price || byName(a, b),
    'price-desc': (a, b) => b.price - a.price || byName(a, b),
    'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
    'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined) continue;
      if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of children) node.append(child);
    return node;
  }

  function buildCard(p) {
    const toggle = el('button', {
      type: 'button',
      class: 'compare-toggle',
      'data-testid': 'compare-toggle',
      'aria-pressed': 'false',
      'aria-label': `Compare ${p.name}`,
      text: 'Compare',
    });
    toggle.addEventListener('click', () => togglePick(p.id));

    const figure = el('figure', { class: 'card-figure' }, [
      el('img', { src: p.image, alt: '', width: '320', height: '240', loading: 'lazy', decoding: 'async' }),
    ]);
    if (p.badge) figure.append(el('span', { class: 'badge', text: p.badge }));

    const facts = el('dl', { class: 'facts' }, [
      el('div', {}, [
        el('dt', { text: 'Energy' }),
        el('dd', {}, [`${p.kcalPer100g}`, el('span', { class: 'unit-line', text: 'kcal/100 g' })]),
      ]),
      el('div', {}, [
        el('dt', { text: 'Protein' }),
        el('dd', {}, [`${p.proteinPct}`, el('span', { text: '%' })]),
      ]),
      el('div', {}, [
        el('dt', { text: 'Our rating' }),
        el('dd', {}, [
          el('span', { 'data-testid': 'product-rating', class: 'rating' }, [
            `${p.rating.toFixed(1)}`, el('span', { text: ' out of 5' }),
          ]),
        ]),
      ]),
    ]);

    const li = el('li', { class: 'card', 'data-testid': 'product-card', 'data-product-id': p.id }, [
      figure,
      el('div', { class: 'card-body' }, [
        el('p', { class: 'card-species', text: p.species === 'dog' ? 'For dogs' : 'For cats' }),
        el('h2', { class: 'card-name' }, [p.name, el('small', { text: `by ${p.brand}` })]),
        facts,
      ]),
      el('div', { class: 'card-foot' }, [
        el('p', { class: 'price-block' }, [
          el('span', { class: 'price', 'data-testid': 'product-price', text: money(p.price) }),
          el('span', { class: 'price-note', text: 'per bag' }),
        ]),
        toggle,
      ]),
    ]);
    return { li, toggle };
  }

  function readFilters() {
    const parse = (v) => (v.trim() === '' ? null : Number(v));
    const min = parse(minInput.value);
    const max = parse(maxInput.value);
    return {
      species: speciesSelect.value,
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
      sort: sorters[sortSelect.value] ? sortSelect.value : 'featured',
    };
  }

  function render() {
    const f = readFilters();
    const shown = products
      .filter((p) => f.species === 'all' || p.species === f.species)
      .filter((p) => f.min === null || p.price >= f.min)
      .filter((p) => f.max === null || p.price <= f.max)
      .sort(sorters[f.sort]);

    const shownIds = new Set(shown.map((p) => p.id));
    for (const [id, { li }] of cards) li.hidden = !shownIds.has(id);
    for (const p of shown) list.append(cards.get(p.id).li);

    empty.hidden = shown.length > 0;
    resultCount.textContent = shown.length === products.length
      ? `Showing all ${products.length} foods`
      : `Showing ${shown.length} of ${products.length} foods`;
  }

  function togglePick(id) {
    const at = picked.indexOf(id);
    if (at >= 0) picked.splice(at, 1);
    else if (picked.length < MAX_PICKS) picked.push(id);
    renderPicks();
  }

  function renderPicks() {
    const full = picked.length >= MAX_PICKS;
    for (const [id, { li, toggle }] of cards) {
      const on = picked.includes(id);
      toggle.setAttribute('aria-pressed', String(on));
      toggle.disabled = full && !on;
      li.classList.toggle('is-picked', on);
    }
    countEl.textContent = String(picked.length);
    slots.forEach((slot, i) => {
      const p = products.find((x) => x.id === picked[i]);
      slot.textContent = p ? p.name : `Pick ${['one', 'another', 'a third'][i]}`;
      slot.classList.toggle('is-filled', Boolean(p));
    });
    bar.hidden = picked.length === 0;
    section.classList.toggle('has-selection', picked.length > 0);
  }

  function clearPicks() {
    picked.length = 0;
    renderPicks();
    const first = Array.from(cards.values()).find(({ li }) => !li.hidden);
    (first ? first.toggle : speciesSelect).focus();
  }

  form.addEventListener('submit', (e) => e.preventDefault());
  for (const control of [speciesSelect, sortSelect]) control.addEventListener('change', render);
  for (const control of [minInput, maxInput]) control.addEventListener('input', render);
  clearButton.addEventListener('click', clearPicks);

  fetch('data/products.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      symbol = data.currency.symbol;
      for (const s of document.querySelectorAll('.money-symbol')) s.textContent = symbol;
      products = data.products.map((p, index) => ({ ...p, index }));
      for (const p of products) cards.set(p.id, buildCard(p));
      render();
      renderPicks();
    })
    .catch(() => {
      resultCount.textContent = 'The food list could not be loaded. Reload the page to try again.';
    });
})();
