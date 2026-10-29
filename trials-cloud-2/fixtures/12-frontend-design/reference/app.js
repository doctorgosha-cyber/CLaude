(async function () {
  const MAX_COMPARE = 3;
  const $ = (id) => document.getElementById(id);
  const species = $('species');
  const priceMin = $('price-min');
  const priceMax = $('price-max');
  const sort = $('sort');
  const list = $('cards');
  const empty = $('empty');
  const bar = $('bar');
  const count = $('count');
  const clear = $('clear');
  const resultsCount = $('results-count');

  const data = await (await fetch('data/products.json')).json();
  const symbol = data.currency.symbol;
  const products = data.products.map((p, i) => ({ ...p, order: i }));
  const selected = new Set();

  const money = (n) => symbol + Number(n).toFixed(2);
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const sorters = {
    featured: (a, b) => a.order - b.order,
    'price-asc': (a, b) => a.price - b.price || byName(a, b),
    'price-desc': (a, b) => b.price - a.price || byName(a, b),
    'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
    'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
  };

  const cardFor = (p) => {
    const li = document.createElement('li');
    li.className = 'card';
    li.dataset.testid = 'product-card';
    li.dataset.productId = p.id;
    li.innerHTML = `
      <img src="${p.image}" alt="" width="320" height="240">
      <div class="card__body">
        ${p.badge ? `<span class="card__badge"></span>` : ''}
        <h2></h2>
        <p class="card__brand"></p>
        <p class="card__price" data-testid="product-price"></p>
        <dl>
          <dt>Rating</dt><dd data-testid="product-rating"></dd>
          <dt>Energy</dt><dd class="kcal"></dd>
          <dt>Protein</dt><dd class="protein"></dd>
        </dl>
        <button type="button" class="card__toggle" data-testid="compare-toggle" aria-pressed="false"><span class="card__toggle-text"></span> <span class="visually-hidden"></span></button>
      </div>`;
    if (p.badge) li.querySelector('.card__badge').textContent = p.badge;
    li.querySelector('h2').textContent = p.name;
    li.querySelector('.card__brand').textContent = p.brand;
    li.querySelector('[data-testid="product-price"]').textContent = money(p.price);
    const rating = li.querySelector('[data-testid="product-rating"]');
    rating.textContent = `${p.rating.toFixed(1)} out of 5`;
    li.querySelector('.kcal').textContent = `${p.kcalPer100g} kcal / 100 g`;
    li.querySelector('.protein').textContent = `${p.proteinPct} % protein`;
    const toggle = li.querySelector('.card__toggle');
    toggle.querySelector('.visually-hidden').textContent = p.name;
    toggle.addEventListener('click', () => {
      if (selected.has(p.id)) selected.delete(p.id);
      else if (selected.size < MAX_COMPARE) selected.add(p.id);
      renderSelection();
    });
    return li;
  };

  const cards = new Map(products.map((p) => [p.id, cardFor(p)]));

  function bound(input) {
    const v = parseFloat(input.value);
    return Number.isFinite(v) ? v : null;
  }

  function render() {
    const sp = species.value;
    const min = bound(priceMin);
    const max = bound(priceMax);
    const visible = products
      .filter((p) => (sp === 'all' || p.species === sp) && (min === null || p.price >= min) && (max === null || p.price <= max))
      .sort(sorters[sort.value] || sorters.featured);
    list.replaceChildren(...visible.map((p) => cards.get(p.id)));
    empty.hidden = visible.length > 0;
    resultsCount.textContent = visible.length === products.length
      ? `Showing all ${products.length} foods`
      : `Showing ${visible.length} of ${products.length} foods`;
  }

  function renderSelection() {
    const full = selected.size >= MAX_COMPARE;
    for (const [id, card] of cards) {
      const on = selected.has(id);
      const toggle = card.querySelector('.card__toggle');
      toggle.setAttribute('aria-pressed', String(on));
      toggle.querySelector('.card__toggle-text').textContent = on ? 'Remove from compare' : 'Add to compare';
      toggle.disabled = full && !on;
      card.classList.toggle('card--selected', on);
    }
    count.textContent = String(selected.size);
    bar.hidden = selected.size === 0;
  }

  for (const el of [species, priceMin, priceMax, sort]) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  }
  clear.addEventListener('click', () => { selected.clear(); renderSelection(); });

  render();
  renderSelection();
})();
