// Behaviour spec for task 12 (product comparison). Imported by grade.mjs; run through hidden/harness.mjs.
import path from 'node:path';
import { assert, eq, tabOrder, tabTo, hasFocusRing, noHorizontalOverflow } from './harness.mjs';

const here = new URL('.', import.meta.url).pathname;
export const name = '12-frontend-design';
export const dataFile = 'data/products.json';
export const hiddenDataFile = path.join(here, 'data', 'products.json');
export const renderedSelector = '[data-testid="product-card"]';
export const testIds = ['comparison-section', 'filter-species', 'filter-price-min', 'filter-price-max', 'sort-select', 'product-card',
  'product-price', 'product-rating', 'compare-toggle', 'compare-bar', 'compare-count', 'compare-clear', 'empty-results'];

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const sorters = {
  featured: () => 0,
  'price-asc': (a, b) => a.price - b.price || byName(a, b),
  'price-desc': (a, b) => b.price - a.price || byName(a, b),
  'rating-desc': (a, b) => b.rating - a.rating || byName(a, b),
  'protein-desc': (a, b) => b.proteinPct - a.proteinPct || byName(a, b),
};
const expectOrder = (products, key, pred = () => true) => products.filter(pred).slice().sort(sorters[key]).map((p) => p.id);

const T = (id) => `[data-testid="${id}"]`;
const visibleIds = (page) => page.$$eval(T('product-card'), (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => e.getAttribute('data-product-id')));
const isVisible = async (page, id) => { const l = page.locator(T(id)); return (await l.count()) > 0 && l.first().isVisible(); };
async function setNumber(page, id, value) { const l = page.locator(T(id)); await l.fill(value); await l.dispatchEvent('input'); await l.dispatchEvent('change'); await page.waitForTimeout(60); }
async function setSelect(page, id, value) { await page.locator(T(id)).selectOption(value); await page.waitForTimeout(60); }
async function reset(page) { await setSelect(page, 'filter-species', 'all'); await setNumber(page, 'filter-price-min', ''); await setNumber(page, 'filter-price-max', ''); await setSelect(page, 'sort-select', 'featured'); }
const toggleOf = (page, id) => page.locator(`${T('product-card')}[data-product-id="${id}"] ${T('compare-toggle')}`);
const countText = (page) => page.locator(T('compare-count')).first().evaluate((e) => e.textContent.trim());
const pressed = (page, id) => toggleOf(page, id).getAttribute('aria-pressed');

export const behaviourNames = ['cards-6-ids', 'price-format', 'rating-format', 'card-content', 'filter-species', 'filter-price-min', 'filter-price-max',
  'filter-combined-and-empty', 'sort-price-asc', 'sort-price-desc', 'sort-rating-desc-ties', 'sort-protein-desc-ties', 'sort-with-filter',
  'compare-cap-and-count', 'compare-bar-sticky-hidden', 'compare-survives-filter', 'compare-clear', 'keyboard-tab-reaches-controls',
  'keyboard-enter-space-toggle', 'focus-visible', 'no-horizontal-overflow'];

export async function behaviour({ page, viewport, data, t }) {
  const P = data.products, sym = data.currency.symbol;
  const ids = P.map((p) => p.id);
  const by = Object.fromEntries(P.map((p) => [p.id, p]));

  await t('cards-6-ids', async () => { const v = await visibleIds(page); eq(v.slice().sort(), ids.slice().sort(), 'visible product ids'); });
  await t('price-format', async () => {
    const got = await page.$$eval(T('product-card'), (els) => els.map((e) => [e.getAttribute('data-product-id'), (e.querySelector('[data-testid="product-price"]') || {}).textContent]));
    for (const [id, txt] of got) eq((txt || '').trim().replace(/\s+/g, ''), sym + by[id].price.toFixed(2), `price of ${id}`);
  });
  await t('rating-format', async () => {
    const got = await page.$$eval(T('product-card'), (els) => els.map((e) => [e.getAttribute('data-product-id'), (e.querySelector('[data-testid="product-rating"]') || {}).textContent]));
    for (const [id, txt] of got) assert(new RegExp(`(^|[^\\d.])${by[id].rating.toFixed(1).replace('.', '\\.')}(?![\\d])`).test((txt || '').trim()), `rating of ${id}: "${(txt || '').trim()}" should contain ${by[id].rating.toFixed(1)}`);
  });
  await t('card-content', async () => {
    const got = await page.$$eval(T('product-card'), (els) => els.map((e) => [e.getAttribute('data-product-id'), e.textContent.replace(/\s+/g, ' ')]));
    for (const [id, txt] of got) { const p = by[id]; for (const needle of [p.name, p.brand, String(p.kcalPer100g), String(p.proteinPct), p.badge].filter(Boolean)) assert(txt.includes(needle), `card ${id} lacks "${needle}"`); }
  });
  await t('filter-species', async () => {
    await setSelect(page, 'filter-species', 'cat'); eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].species === 'cat').sort(), 'cat');
    await setSelect(page, 'filter-species', 'dog'); eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].species === 'dog').sort(), 'dog');
    await setSelect(page, 'filter-species', 'all'); eq((await visibleIds(page)).sort(), ids.slice().sort(), 'all');
  });
  await t('filter-price-min', async () => {
    await setNumber(page, 'filter-price-min', '12.5'); eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].price >= 12.5).sort(), 'min 12.5 (inclusive)');
    await setNumber(page, 'filter-price-min', '12.51'); eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].price >= 12.51).sort(), 'min 12.51');
    await setNumber(page, 'filter-price-min', ''); eq((await visibleIds(page)).sort(), ids.slice().sort(), 'empty min = no bound');
  });
  await t('filter-price-max', async () => {
    await setNumber(page, 'filter-price-max', '20'); eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].price <= 20).sort(), 'max 20 (inclusive)');
    await setNumber(page, 'filter-price-max', '19.99'); eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].price <= 19.99).sort(), 'max 19.99');
    await setNumber(page, 'filter-price-max', ''); eq((await visibleIds(page)).sort(), ids.slice().sort(), 'empty max = no bound');
  });
  await t('filter-combined-and-empty', async () => {
    await setNumber(page, 'filter-price-min', '12.5'); await setNumber(page, 'filter-price-max', '20');
    eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].price >= 12.5 && by[i].price <= 20).sort(), 'min+max');
    assert(!(await isVisible(page, 'empty-results')), 'empty-results must be hidden while cards are shown');
    await setSelect(page, 'filter-species', 'dog');
    eq((await visibleIds(page)).sort(), ids.filter((i) => by[i].price >= 12.5 && by[i].price <= 20 && by[i].species === 'dog').sort(), 'min+max+dog');
    await setNumber(page, 'filter-price-min', '25');
    eq(await visibleIds(page), [], 'min 25 max 20 → nothing');
    assert(await isVisible(page, 'empty-results'), 'empty-results must be visible when nothing matches');
    const txt = await page.locator(T('empty-results')).first().evaluate((e) => e.textContent.trim());
    assert(txt.length >= 10, 'empty-results message must have text');
    await reset(page);
    eq((await visibleIds(page)).sort(), ids.slice().sort(), 'after reset');
    assert(!(await isVisible(page, 'empty-results')), 'empty-results hidden after reset');
  });
  await t('sort-price-asc', async () => { await setSelect(page, 'sort-select', 'price-asc'); eq(await visibleIds(page), expectOrder(P, 'price-asc'), 'order'); });
  await t('sort-price-desc', async () => { await setSelect(page, 'sort-select', 'price-desc'); eq(await visibleIds(page), expectOrder(P, 'price-desc'), 'order'); });
  await t('sort-rating-desc-ties', async () => { await setSelect(page, 'sort-select', 'rating-desc'); eq(await visibleIds(page), expectOrder(P, 'rating-desc'), 'order (ties by name, case-insensitive)'); });
  await t('sort-protein-desc-ties', async () => { await setSelect(page, 'sort-select', 'protein-desc'); eq(await visibleIds(page), expectOrder(P, 'protein-desc'), 'order (ties by name)'); });
  await t('sort-with-filter', async () => {
    await setSelect(page, 'filter-species', 'cat'); await setSelect(page, 'sort-select', 'price-desc');
    eq(await visibleIds(page), expectOrder(P, 'price-desc', (p) => p.species === 'cat'), 'cat + price-desc');
    await setSelect(page, 'sort-select', 'featured'); eq(await visibleIds(page), ids.filter((i) => by[i].species === 'cat'), 'cat + featured keeps JSON order');
    await reset(page); eq(await visibleIds(page), ids, 'featured = JSON order');
  });

  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(100);
  const [a, b, c, d] = ids;
  await t('compare-cap-and-count', async () => {
    for (const id of [a, b, c]) await toggleOf(page, id).click();
    eq(await countText(page), '3', 'count after 3');
    for (const id of [a, b, c]) eq(await pressed(page, id), 'true', `aria-pressed ${id}`);
    eq(await toggleOf(page, d).isDisabled(), true, `4th toggle (${d}) must be disabled at the cap`);
    await toggleOf(page, d).evaluate((el) => el.click());
    eq(await countText(page), '3', 'count stays 3 after clicking a 4th');
    eq(await pressed(page, d), 'false', '4th stays unpressed');
    await toggleOf(page, a).click();
    eq(await countText(page), '2', 'count after deselect');
    eq(await pressed(page, a), 'false', 'deselected');
    eq(await toggleOf(page, d).isDisabled(), false, 'others re-enabled below the cap');
    assert(/^\d+$/.test(await countText(page)), 'compare-count text must be the number only');
  });
  await t('compare-bar-sticky-hidden', async () => {
    assert(await isVisible(page, 'compare-bar'), 'bar visible with 2 selected');
    const pos = await page.locator(T('compare-bar')).first().evaluate((e) => getComputedStyle(e).position);
    assert(pos === 'fixed' || pos === 'sticky', `compare-bar position is ${pos}, want fixed/sticky`);
    await toggleOf(page, b).click(); await toggleOf(page, c).click();
    eq(await countText(page).catch(() => '0'), '0', 'count 0');
    assert(!(await isVisible(page, 'compare-bar')), 'bar hidden with nothing selected');
  });
  await t('compare-survives-filter', async () => {
    const dog = ids.find((i) => by[i].species === 'dog');
    await toggleOf(page, dog).click(); eq(await countText(page), '1', 'one selected');
    await setSelect(page, 'filter-species', 'cat');
    assert(await isVisible(page, 'compare-bar'), 'bar still visible after filtering the selected product out');
    eq(await countText(page), '1', 'selection survives filtering');
    await setSelect(page, 'filter-species', 'all');
    eq(await pressed(page, dog), 'true', 'product comes back selected');
  });
  await t('compare-clear', async () => {
    await toggleOf(page, b).click(); eq(await countText(page), '2', 'two selected');
    await page.locator(T('compare-clear')).first().click();
    assert(!(await isVisible(page, 'compare-bar')), 'bar hidden after clear');
    for (const id of ids) eq(await pressed(page, id), 'false', `cleared ${id}`);
  });

  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(100);
  await t('keyboard-tab-reaches-controls', async () => {
    const seen = await tabOrder(page, 60);
    for (const id of ['filter-species', 'filter-price-min', 'filter-price-max', 'sort-select', 'compare-toggle']) assert(seen.includes(id), `Tab never reached ${id} (reached: ${seen.filter(Boolean).join(',')})`);
    const firstToggle = seen.indexOf('compare-toggle'), lastFilter = Math.max(...['filter-species', 'filter-price-min', 'filter-price-max', 'sort-select'].map((i) => seen.indexOf(i)));
    assert(firstToggle > lastFilter, 'filters/sort must come before the cards in tab order');
  });
  await t('keyboard-enter-space-toggle', async () => {
    const tg = toggleOf(page, a); await tg.focus();
    await page.keyboard.press('Enter'); eq(await pressed(page, a), 'true', 'Enter toggles on'); eq(await countText(page), '1', 'count 1');
    await page.keyboard.press('Space'); eq(await pressed(page, a), 'false', 'Space toggles off');
    assert(!(await isVisible(page, 'compare-bar')), 'bar hidden again');
  });
  await t('focus-visible', async () => {
    assert(await tabTo(page, 'compare-toggle'), 'could not tab to a compare-toggle');
    assert(await hasFocusRing(page), 'focused compare-toggle has no visible outline/box-shadow');
    assert(await tabTo(page, 'filter-species'), 'could not tab to filter-species');
    assert(await hasFocusRing(page), 'focused filter-species has no visible focus indicator');
  });
  await t('no-horizontal-overflow', async () => assert(await noHorizontalOverflow(page, viewport.width), `page is wider than ${viewport.width}px`));
}

export const axeStates = [
  { name: 'desktop-initial', viewport: 'desktop', setup: async () => {} },
  { name: 'desktop-2-selected', viewport: 'desktop', setup: async (page) => { const ts = page.locator(T('compare-toggle')); await ts.nth(0).click(); await ts.nth(1).click(); await page.waitForTimeout(80); } },
  { name: 'desktop-empty-results', viewport: 'desktop', setup: async (page) => { await setNumber(page, 'filter-price-min', '999'); } },
  { name: 'mobile-initial', viewport: 'mobile', setup: async () => {} },
];
