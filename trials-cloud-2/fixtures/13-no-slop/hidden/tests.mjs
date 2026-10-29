// Behaviour spec for task 13 (Anatomy of Things landing section). Graded by ../../12-frontend-design/hidden/harness.mjs.
import path from 'node:path';
import { assert, eq, tabOrder, tabTo, hasFocusRing, noHorizontalOverflow } from '../../12-frontend-design/hidden/harness.mjs';

const here = new URL('.', import.meta.url).pathname;
export const name = '13-no-slop';
export const dataFile = 'data/films.json';
export const hiddenDataFile = path.join(here, 'data', 'films.json');
export const renderedSelector = '[data-testid="film-card"]';
export const testIds = ['hero', 'lang-select', 'film-card', 'film-title', 'film-duration', 'film-langs', 'film-link', 'newsletter-form',
  'newsletter-email', 'newsletter-submit', 'newsletter-status'];

const T = (id) => `[data-testid="${id}"]`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const cardInfo = (page) => page.$$eval(T('film-card'), (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((e) => {
  const q = (id) => e.querySelector(`[data-testid="${id}"]`);
  const title = q('film-title');
  const langEl = title && title.closest('[lang]');
  return { id: e.getAttribute('data-film-id'), title: title ? title.textContent.trim() : null, titleLang: langEl ? langEl.getAttribute('lang') : null,
    duration: q('film-duration') ? q('film-duration').textContent.trim() : null, langs: q('film-langs') ? q('film-langs').textContent.replace(/\s+/g, ' ').trim() : null,
    href: q('film-link') ? q('film-link').getAttribute('href') : null, linkName: q('film-link') ? (q('film-link').getAttribute('aria-label') || q('film-link').textContent).replace(/\s+/g, ' ').trim() : null };
}));
const htmlLang = (page) => page.evaluate(() => document.documentElement.getAttribute('lang'));
const statusInfo = (page) => page.locator(T('newsletter-status')).first().evaluate((e) => ({ state: e.getAttribute('data-state'), text: e.textContent.trim(), role: e.getAttribute('role'), live: e.getAttribute('aria-live') }));
const emailInfo = (page) => page.locator(T('newsletter-email')).first().evaluate((e) => ({ invalid: e.getAttribute('aria-invalid'), focused: document.activeElement === e, type: e.getAttribute('type') }));
async function submit(page, value, how = 'click') {
  const input = page.locator(T('newsletter-email')).first();
  await input.fill(value);
  if (how === 'enter') { await input.focus(); await page.keyboard.press('Enter'); } else await page.locator(T('newsletter-submit')).first().click();
  await page.waitForTimeout(80);
}

export const behaviourNames = ['hero-h1-tagline', 'cards-4-in-order', 'titles-english-default', 'lang-select-options', 'lang-switch-titles-and-fallback',
  'lang-switch-keeps-order-and-focus', 'duration-format', 'language-count', 'film-link', 'status-live-region-at-load', 'invalid-email-error',
  'empty-email-error', 'valid-email-success-trimmed', 'status-updates-again', 'enter-submits', 'keyboard-tab-reaches-controls', 'focus-visible', 'no-horizontal-overflow'];

export async function behaviour({ page, viewport, data, t }) {
  const films = data.films, ids = films.map((f) => f.id), by = Object.fromEntries(films.map((f) => [f.id, f]));
  const startUrl = page.url();

  await t('hero-h1-tagline', async () => {
    const h1s = await page.$$eval('h1', (els) => els.map((e) => e.textContent.trim()));
    eq(h1s.length, 1, 'exactly one h1 on the page');
    assert(h1s[0].includes(data.channel.name), `h1 "${h1s[0]}" must contain "${data.channel.name}"`);
    const hero = page.locator(T('hero')).first();
    assert(await hero.isVisible(), 'hero visible');
    const txt = await hero.evaluate((e) => e.textContent.replace(/\s+/g, ' '));
    assert(txt.includes(data.channel.name) && txt.includes(data.channel.tagline), 'hero must contain the channel name and tagline from the JSON');
    assert(await hero.evaluate((e) => !!e.querySelector('h1')), 'the h1 must be inside the hero');
  });
  await t('cards-4-in-order', async () => { const c = await cardInfo(page); eq(c.map((x) => x.id), ids, 'film ids in JSON order'); });
  await t('titles-english-default', async () => {
    eq(await page.locator(T('lang-select')).first().inputValue(), 'en', 'select value en');
    eq(await htmlLang(page), 'en', 'html lang');
    for (const c of await cardInfo(page)) eq(c.title, by[c.id].titles.en, `title of ${c.id}`);
  });
  await t('lang-select-options', async () => {
    const opts = await page.$$eval(T('lang-select') + ' option', (os) => os.map((o) => [o.value, o.textContent.trim()]));
    eq(opts, data.languages.map((l) => [l.code, l.name]), 'options value/text in JSON order');
  });
  await t('lang-switch-titles-and-fallback', async () => {
    for (const code of ['de', 'pl', 'ja', 'en']) {
      await page.locator(T('lang-select')).first().selectOption(code); await page.waitForTimeout(80);
      eq(await htmlLang(page), code, `html lang after switching to ${code}`);
      for (const c of await cardInfo(page)) {
        const f = by[c.id], has = !!f.titles[code];
        eq(c.title, has ? f.titles[code] : f.titles.en, `title of ${c.id} in ${code}`);
        if (!has) eq(c.titleLang, 'en', `fallback title of ${c.id} must sit in lang="en"`);
        else assert(c.titleLang === null || c.titleLang === code, `translated title of ${c.id} must not be marked lang="${c.titleLang}"`);
      }
    }
  });
  await t('lang-switch-keeps-order-and-focus', async () => {
    const sel = page.locator(T('lang-select')).first();
    await sel.focus(); await sel.selectOption('fr'); await page.waitForTimeout(80);
    eq(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid')), 'lang-select', 'focus stays on the select');
    eq((await cardInfo(page)).map((x) => x.id), ids, 'order unchanged after switching');
    await sel.selectOption('en'); await page.waitForTimeout(50);
  });
  await t('duration-format', async () => { for (const c of await cardInfo(page)) eq(c.duration, mmss(by[c.id].durationSeconds), `duration of ${c.id}`); });
  await t('language-count', async () => {
    for (const c of await cardInfo(page)) { const n = by[c.id].languages.length; const want = n === 1 ? /\b1 language\b(?!s)/ : new RegExp(`\\b${n} languages\\b`);
      assert(want.test(c.langs || ''), `film-langs of ${c.id} is "${c.langs}", want ${n === 1 ? '"1 language"' : `"${n} languages"`}`); }
  });
  await t('film-link', async () => {
    for (const c of await cardInfo(page)) { eq(c.href, by[c.id].url, `href of ${c.id}`); assert((c.linkName || '').includes(by[c.id].titles.en), `link name of ${c.id} must include the title`); }
  });
  await t('status-live-region-at-load', async () => {
    const s = await statusInfo(page);
    assert(s.role === 'status' || s.live === 'polite' || s.live === 'assertive', 'newsletter-status needs role="status" or aria-live');
    eq(s.text, '', 'status empty at load');
    assert(await page.locator(T('newsletter-form')).first().evaluate((f) => f.hasAttribute('novalidate')), 'form must have novalidate');
    eq((await emailInfo(page)).type, 'email', 'input type=email');
  });
  await t('invalid-email-error', async () => {
    await submit(page, 'a@b');
    const s = await statusInfo(page), e = await emailInfo(page);
    eq(s.state, 'error', 'data-state'); assert(s.text.length >= 8, 'error message text'); eq(e.invalid, 'true', 'aria-invalid'); assert(e.focused, 'focus moved to the email input');
    eq(page.url(), startUrl, 'no navigation');
    await submit(page, 'user@@example.com'); eq((await statusInfo(page)).state, 'error', 'double @ is an error');
  });
  await t('empty-email-error', async () => {
    await submit(page, ''); const s = await statusInfo(page);
    eq(s.state, 'error', 'empty → error'); assert(s.text.length >= 8, 'error text'); eq(page.url(), startUrl, 'no navigation');
  });
  await t('valid-email-success-trimmed', async () => {
    await submit(page, '  user@example.com  ');
    const s = await statusInfo(page), e = await emailInfo(page);
    eq(s.state, 'success', 'data-state'); assert(s.text.length >= 8, 'success text'); assert(e.invalid === null || e.invalid === 'false', 'aria-invalid cleared');
    eq(page.url(), startUrl, 'no navigation');
  });
  await t('status-updates-again', async () => {
    await submit(page, 'nope'); eq((await statusInfo(page)).state, 'error', 'error after success');
    await submit(page, 'second@example.org'); eq((await statusInfo(page)).state, 'success', 'success again');
  });
  await t('enter-submits', async () => {
    await submit(page, 'bad address', 'enter'); const s = await statusInfo(page);
    eq(s.state, 'error', 'Enter in the field submits'); eq(page.url(), startUrl, 'no navigation');
  });

  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(100);
  await t('keyboard-tab-reaches-controls', async () => {
    const seen = await tabOrder(page, 60);
    for (const id of ['lang-select', 'film-link', 'newsletter-email', 'newsletter-submit']) assert(seen.includes(id), `Tab never reached ${id} (reached: ${seen.filter(Boolean).join(',')})`);
  });
  await t('focus-visible', async () => {
    assert(await tabTo(page, 'film-link'), 'could not tab to a film-link');
    assert(await hasFocusRing(page), 'focused film-link has no visible outline/box-shadow');
    assert(await tabTo(page, 'newsletter-submit'), 'could not tab to newsletter-submit');
    assert(await hasFocusRing(page), 'focused submit button has no visible focus indicator');
  });
  await t('no-horizontal-overflow', async () => assert(await noHorizontalOverflow(page, viewport.width), `page is wider than ${viewport.width}px`));
}

export const axeStates = [
  { name: 'desktop-initial', viewport: 'desktop', setup: async () => {} },
  { name: 'desktop-error-state', viewport: 'desktop', setup: async (page) => { await submit(page, 'a@b'); } },
  { name: 'desktop-ja', viewport: 'desktop', setup: async (page) => { await page.locator(T('lang-select')).first().selectOption('ja'); await page.waitForTimeout(80); } },
  { name: 'mobile-initial', viewport: 'mobile', setup: async () => {} },
];
