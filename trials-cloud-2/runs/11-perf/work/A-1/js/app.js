/* SoundBench comparison page — client-side behaviour.
 *
 * Data contract
 *   data/products.json          -> the catalogue, in editor's order: [{ id, name, brand, price, rating, battery_h, weight_g }]
 *   data/product-<id>.json      -> detail record: { brand, price, rating, battery_h, weight_g }
 * The catalogue now carries the detail fields, so the page needs a single request; a product
 * without them (an older catalogue export) still falls back to its detail record. Detail
 * records are fetched in parallel; the row order is always the catalogue order.
 */
(function () {
  'use strict';

  var state = {
    rows: [],          // merged product records, in editor's (catalogue) order
    sort: 'default',
    filter: '',
    compare: []        // ids currently ticked for comparison
  };

  var COMPARE_LIMIT = 4;

  function formatPrice(n) {
    // Euro, two decimals, thousands separated by a comma: 1249.5 -> "€1,249.50"
    var fixed = n.toFixed(2);
    var parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '€' + parts.join('.');
  }

  function formatRating(r) {
    return r.toFixed(1) + ' / 5';
  }

  // ---------- data loading ----------

  function hasDetail(p) {
    return p && typeof p.price === 'number' && typeof p.rating === 'number' &&
           p.brand != null && p.battery_h != null && p.weight_g != null;
  }

  async function loadCatalogue() {
    var res = await fetch('data/products.json');
    var list = await res.json();
    return Promise.all(list.map(async function (p) {
      if (hasDetail(p)) return Object.assign({}, p);
      var detailRes = await fetch('data/product-' + p.id + '.json');
      var detail = await detailRes.json();
      return Object.assign({}, p, detail);
    }));
  }

  // ---------- sorting ----------
  // Sort rules (the QA regression suite checks these exactly):
  //   price-asc / price-desc : ties on price are broken by rating, HIGHER rating first,
  //                            then by model name A-Z. (Same tie-break in both directions.)
  //   rating-desc            : ties on rating are broken by price, LOWER price first, then name A-Z.
  //   name-asc               : model name A-Z, locale-aware.
  //   default                : editor's order, i.e. the order of data/products.json.
  function byName(a, b) {
    return a.name.localeCompare(b.name, 'en');
  }
  function comparators() {
    return {
      'default': function (a, b) { return a._index - b._index; },
      'price-asc': function (a, b) {
        return (a.price - b.price) || (b.rating - a.rating) || byName(a, b);
      },
      'price-desc': function (a, b) {
        return (b.price - a.price) || (b.rating - a.rating) || byName(a, b);
      },
      'rating-desc': function (a, b) {
        return (b.rating - a.rating) || (a.price - b.price) || byName(a, b);
      },
      'name-asc': byName
    };
  }

  function sortedRows() {
    var cmp = comparators()[state.sort] || comparators()['default'];
    return state.rows.slice().sort(cmp);
  }

  // ---------- filtering ----------
  // The filter box matches case-insensitively against BOTH the model name and the brand,
  // so typing "acme" lists every Acme model even though "Acme" is not part of the model name.
  // Whitespace around the query is ignored; an empty query shows everything.
  function matchesFilter(row) {
    var q = state.filter.trim().toLowerCase();
    if (!q) return true;
    return row.name.toLowerCase().indexOf(q) !== -1 ||
           row.brand.toLowerCase().indexOf(q) !== -1;
  }

  // ---------- rendering ----------

  function renderTable() {
    var body = document.getElementById('comparison-body');
    var rows = sortedRows();
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var hidden = matchesFilter(r) ? '' : ' hidden';
      var checked = state.compare.indexOf(r.id) !== -1 ? ' checked' : '';
      html +=
        '<tr data-id="' + r.id + '"' + hidden + '>' +
          '<td class="col-compare"><input type="checkbox" class="compare-check" data-id="' + r.id + '" aria-label="Compare ' + escapeHtml(r.name) + '"' + checked + '></td>' +
          '<td class="col-name">' + escapeHtml(r.name) + '</td>' +
          '<td class="col-brand">' + escapeHtml(r.brand) + '</td>' +
          '<td class="col-price">' + formatPrice(r.price) + '</td>' +
          '<td class="col-rating">' + formatRating(r.rating) + '</td>' +
          '<td class="col-battery">' + r.battery_h + ' h</td>' +
          '<td class="col-weight">' + r.weight_g + ' g</td>' +
        '</tr>';
    }
    body.innerHTML = html;
    tq('event', 'table_render', { rows: rows.length, sort: state.sort });
  }

  function applyFilter() {
    // Cheap path: toggle row visibility without rebuilding the table.
    var trs = document.querySelectorAll('#comparison-body tr[data-id]');
    for (var i = 0; i < trs.length; i++) {
      var row = rowById(trs[i].getAttribute('data-id'));
      trs[i].hidden = !matchesFilter(row);
    }
  }

  function rowById(id) {
    for (var i = 0; i < state.rows.length; i++) {
      if (String(state.rows[i].id) === String(id)) return state.rows[i];
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- compare basket ----------
  // At most COMPARE_LIMIT (4) products can be ticked. Ticking a fifth box is rejected:
  // the box is unticked again and #compare-msg shows "You can compare up to 4 products".
  // The counter (#compare-count) always reads "<n> selected". Unticking clears the message.
  function updateCompareStatus(msg) {
    document.getElementById('compare-count').textContent = state.compare.length + ' selected';
    document.getElementById('compare-msg').textContent = msg || '';
  }

  function onCompareChange(e) {
    var box = e.target;
    if (!box.classList || !box.classList.contains('compare-check')) return;
    var id = box.getAttribute('data-id');
    if (box.checked) {
      if (state.compare.length >= COMPARE_LIMIT) {
        box.checked = false;
        updateCompareStatus('You can compare up to ' + COMPARE_LIMIT + ' products');
        return;
      }
      state.compare.push(id);
      updateCompareStatus('');
    } else {
      state.compare = state.compare.filter(function (x) { return x !== id; });
      updateCompareStatus('');
    }
  }

  // ---------- FAQ accordion ----------

  function initFaq() {
    var buttons = document.querySelectorAll('.faq-q');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var btn = e.currentTarget;
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.hidden = open;
      });
    }
  }

  // ---------- newsletter ----------

  function initNewsletter() {
    var form = document.getElementById('newsletter');
    var input = document.getElementById('newsletter-email');
    var msg = document.getElementById('newsletter-msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var value = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        msg.textContent = 'Please enter a valid email address.';
        msg.className = 'error';
        return;
      }
      msg.textContent = 'Thanks! Check your inbox to confirm.';
      msg.className = 'ok';
      form.reset();
    });
  }

  // ---------- promo banner ----------
  // Shown on every page view once the page has settled; copy comes from marketing.
  // The banner's box is already in the markup (its space is reserved from the first paint, so
  // revealing it does not shift the page); this just fades it in. If a template ever omits it,
  // the banner is created as before.
  function showPromoBanner() {
    var banner = document.getElementById('promo-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'promo-banner';
      banner.id = 'promo-banner';
      banner.innerHTML = '<strong>Free shipping on orders over €50</strong> — this week only, on every model in the table. <span class="promo-terms">Applies to orders shipped within the EU; the discount is shown at checkout.</span>';
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.removeAttribute('aria-hidden');
    banner.classList.add('is-visible');
  }

  // ---------- analytics ----------
  // tq-analytics is 300 KB and only consumes the event queue, so it is loaded once the page
  // is idle. The inline stub in index.html queues every tq() call made before then.
  function loadAnalytics() {
    if (document.querySelector('script[src="js/vendor/tq-analytics.js"]')) return;
    var s = document.createElement('script');
    s.src = 'js/vendor/tq-analytics.js';
    s.async = true;
    document.body.appendChild(s);
  }

  // ---------- boot ----------

  function init() {
    initFaq();
    initNewsletter();
    document.getElementById('sort').addEventListener('change', function (e) {
      state.sort = e.target.value;
      renderTable();
    });
    document.getElementById('filter').addEventListener('input', function (e) {
      state.filter = e.target.value;
      applyFilter();
    });
    document.getElementById('comparison-body').addEventListener('change', onCompareChange);

    loadCatalogue().then(function (rows) {
      state.rows = rows.map(function (r, i) { r._index = i; return r; });
      renderTable();
      updateCompareStatus('');
    }).catch(function (err) {
      document.getElementById('comparison-body').innerHTML =
        '<tr><td colspan="7">Could not load the comparison data.</td></tr>';
      console.error(err);
    });

    // Marketing wants the banner to slide in once the page has painted, not before.
    function afterLoad() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { setTimeout(showPromoBanner, 300); });
      });
      requestIdleCallback(loadAnalytics, { timeout: 2000 });
    }
    if (document.readyState === 'complete') {
      afterLoad();
    } else {
      window.addEventListener('load', afterLoad);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
