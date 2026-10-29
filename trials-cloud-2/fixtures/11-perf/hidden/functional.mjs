// Hidden functional + content tests, driven by playwright-core.
export function formatPrice(n) {
  const parts = n.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '€' + parts.join('.');
}
const byName = (a, b) => a.name.localeCompare(b.name, 'en');
export const ORDERS = {
  'price-asc': (a, b) => (a.price - b.price) || (b.rating - a.rating) || byName(a, b),
  'rating-desc': (a, b) => (b.rating - a.rating) || (a.price - b.price) || byName(a, b),
};
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function poll(fn, ok, timeout = 5000, step = 100) {
  const t0 = Date.now();
  let last;
  for (;;) {
    last = await fn();
    if (ok(last)) return last;
    if (Date.now() - t0 > timeout) return last;
    await sleep(step);
  }
}

export async function runFunctional({ chromium, executablePath, url, expected }) {
  const results = [];
  const add = (name, pass, info = '') => results.push({ name, pass: !!pass, info: String(info).slice(0, 300) });
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [], failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location()?.url || '')) consoleErrors.push(m.text() + (m.location()?.url ? ' @ ' + m.location().url : '')); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { const t = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(t)) failedRequests.push(`${t} ${r.url()}`); });

  const rowsInfo = () => page.$$eval('#comparison-body tr[data-id]', (trs) => trs.map(tr => ({
    id: tr.getAttribute('data-id'),
    visible: !tr.hidden && getComputedStyle(tr).display !== 'none',
    name: (tr.querySelector('.col-name') || {}).textContent || '',
    price: (tr.querySelector('.col-price') || {}).textContent || ''
  })));
  const products = expected.products;
  const idOf = (p) => String(p.id);

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await poll(rowsInfo, (r) => r.length >= 24, 20000, 200);
    await sleep(1500); // let late-inserted content (promo banner) appear

    // 1. table rows + prices
    {
      const rows = await rowsInfo();
      const bad = [];
      for (const p of products) {
        const row = rows.find(r => r.id === idOf(p));
        if (!row) { bad.push(`missing ${p.id}`); continue; }
        if (norm(row.price) !== formatPrice(p.price)) bad.push(`${p.name}: ${norm(row.price)} != ${formatPrice(p.price)}`);
      }
      add('table: 24 rows with the catalogue prices', rows.length === 24 && bad.length === 0, rows.length !== 24 ? `rows=${rows.length}` : bad.join('; '));
    }

    // 2/3. sort (ties)
    for (const mode of ['price-asc', 'rating-desc']) {
      const want = products.slice().sort(ORDERS[mode]).map(idOf);
      await page.selectOption('#sort', mode);
      const got = await poll(async () => (await rowsInfo()).map(r => r.id), (g) => g.join() === want.join(), 4000);
      const wantNames = want.map(id => products.find(p => idOf(p) === id).name);
      const gotNames = got.map(id => (products.find(p => idOf(p) === id) || { name: id }).name);
      add(`sort: ${mode} (ties broken by rating/price, then name)`, got.join() === want.join(), got.join() === want.join() ? '' : `want ${wantNames.join(' > ')} | got ${gotNames.join(' > ')}`);
    }
    {
      const want = products.map(idOf);
      await page.selectOption('#sort', 'default');
      const got = await poll(async () => (await rowsInfo()).map(r => r.id), (g) => g.join() === want.join(), 4000);
      add("sort: back to editor's order", got.join() === want.join(), got.join());
    }

    // 4. filter
    {
      const cases = [
        ['ACME', products.filter(p => p.brand === 'Acme').map(idOf)],
        ['aErO', products.filter(p => /aero/i.test(p.name)).map(idOf)],
        ['', products.map(idOf)],
      ];
      const bad = [];
      for (const [q, want] of cases) {
        await page.fill('#filter', q);
        const got = await poll(async () => (await rowsInfo()).filter(r => r.visible).map(r => r.id).sort(), (g) => g.join() === want.slice().sort().join(), 4000);
        if (got.join() !== want.slice().sort().join()) bad.push(`"${q}": visible ${got.length}, expected ${want.length}`);
      }
      add('filter: case-insensitive, matches model name and brand', bad.length === 0, bad.join('; '));
    }

    // 5. compare basket
    {
      const boxes = await page.$$('#comparison-body .compare-check');
      let info = '';
      let pass = boxes.length >= 5;
      if (pass) {
        for (let i = 0; i < 4; i++) await boxes[i].check();
        const c4 = await poll(() => page.$eval('#compare-count', e => e.textContent), (t) => /4 selected/i.test(t), 2000);
        pass = /^\s*4 selected\s*$/i.test(c4 || '');
        info += `after 4: "${norm(c4 || '')}"`;
        await boxes[4].click();
        await sleep(300);
        const c5 = await page.$eval('#compare-count', e => e.textContent);
        const checked5 = await boxes[4].isChecked();
        const msg = await page.$eval('#compare-msg', e => e.textContent).catch(() => '');
        pass = pass && /^\s*4 selected\s*$/i.test(c5) && !checked5 && /up to 4/i.test(msg);
        info += `; after 5th: "${norm(c5)}", checked=${checked5}, msg="${norm(msg)}"`;
        await boxes[0].uncheck();
        const c3 = await poll(() => page.$eval('#compare-count', e => e.textContent), (t) => /3 selected/i.test(t), 2000);
        pass = pass && /^\s*3 selected\s*$/i.test(c3 || '');
        info += `; after uncheck: "${norm(c3 || '')}"`;
      } else info = `checkboxes=${boxes.length}`;
      add('compare: counter updates, capped at 4 with message', pass, info);
    }

    // 6. hero image
    {
      const h = await page.evaluate(() => {
        const img = document.querySelector('#hero-image') || document.querySelector('.hero img');
        if (!img) return null;
        const b = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        return { alt: img.getAttribute('alt') || '', nw: img.naturalWidth, complete: img.complete, w: b.width, h: b.height, vis: cs.visibility, disp: cs.display, op: cs.opacity };
      });
      const pass = h && h.alt.trim().length >= 5 && h.nw > 0 && h.complete && h.w >= 300 && h.h >= 100 && h.vis !== 'hidden' && h.disp !== 'none' && Number(h.op) > 0;
      add('hero: image visible with alt text', pass, JSON.stringify(h));
    }

    // 7. FAQ
    {
      const r = await page.evaluate(() => {
        const item = document.querySelector('.faq-item');
        if (!item) return null;
        const btn = item.querySelector('.faq-q, button, summary');
        const ans = item.querySelector('.faq-a');
        return { hasBtn: !!btn, hasAns: !!ans };
      });
      let pass = !!(r && r.hasBtn && r.hasAns), info = JSON.stringify(r);
      if (pass) {
        const btn = (await page.$('.faq-item .faq-q')) || (await page.$('.faq-item button, .faq-item summary'));
        const ans = await page.$('.faq-item .faq-a');
        const before = await ans.isVisible();
        await btn.click(); await sleep(250);
        const open = await ans.isVisible();
        await btn.click(); await sleep(250);
        const closed = await ans.isVisible();
        pass = !before && open && !closed;
        info = `before=${before} open=${open} closed=${closed}`;
      }
      add('faq: accordion opens and closes', pass, info);
    }

    // 8. newsletter
    {
      const urlBefore = page.url();
      await page.fill('#newsletter-email', 'not-an-email');
      await page.click('#newsletter button[type="submit"], #newsletter [type="submit"]');
      const err = await poll(() => page.$eval('#newsletter-msg', e => e.textContent).catch(() => ''), (t) => /valid email/i.test(t), 2000);
      await page.fill('#newsletter-email', 'reader@example.com');
      await page.click('#newsletter button[type="submit"], #newsletter [type="submit"]');
      const ok = await poll(() => page.$eval('#newsletter-msg', e => e.textContent).catch(() => ''), (t) => /thanks/i.test(t), 2000);
      const pass = /valid email/i.test(err || '') && /thanks/i.test(ok || '') && page.url() === urlBefore;
      add('newsletter: rejects bad email, accepts good one, no navigation', pass, `err="${norm(err || '')}" ok="${norm(ok || '')}" nav=${page.url() !== urlBefore}`);
    }

    // 9. reviews
    {
      const n = await page.$$eval('#reviews .review', els => els.filter(e => e.getClientRects().length > 0 && (e.textContent || '').trim().length > 20).length);
      add(`reviews: at least ${expected.reviewsMin} visible reviews`, n >= expected.reviewsMin, `visible=${n}`);
    }

    // 10-12. content
    {
      const text = norm(await page.evaluate(() => document.body.innerText));
      const missingH = expected.headings.filter(h => !text.includes(norm(h)));
      add('content: the six section headings are present', missingH.length === 0, missingH.join(' | '));
      const missingP = products.filter(p => !text.includes(p.name)).map(p => p.name);
      add('content: all 24 product names are present', missingP.length === 0, missingP.join(', '));
      const bannerText = await poll(async () => norm(await page.evaluate(() => document.body.innerText)), (t) => t.includes(norm(expected.banner)), 3000, 250);
      add('content: promo banner text is present', bannerText.includes(norm(expected.banner)), bannerText.includes(norm(expected.banner)) ? '' : 'banner missing');
    }
  } catch (e) {
    add('harness: page loaded and tests ran', false, e.message);
  }

  add('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  add('no failed requests (4xx/5xx/network)', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));
  await browser.close();
  return results;
}
