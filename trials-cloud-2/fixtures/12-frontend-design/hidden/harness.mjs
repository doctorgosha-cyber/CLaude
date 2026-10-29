// Shared grading harness for tasks 12-frontend-design and 13-no-slop.
// Tools (playwright-core 1.64.1, axe-core 4.14.0, lighthouse 13.6.0) live in TRIAL_TOOLS_DIR.
import { createServer } from 'node:http';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const TOOLS = process.env.TRIAL_TOOLS_DIR
  || '/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/12-frontend-design';
export const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const require = createRequire(path.join(TOOLS, 'package.json'));
export const { chromium } = require('playwright-core');
export const AXE_PATH = require.resolve('axe-core/axe.min.js');
export const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const LH = { accessibilityMin: 90, performanceMin: 85 };

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };

/** Serve a directory on a random localhost port. */
export function serveDir(root) {
  const server = createServer(async (req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/'; }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

export async function launchBrowser() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

export async function openPage(browser, viewport, url) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(1500);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(150);
  return { page, context, errors };
}

/** Test collector: t(name, fn) records pass/fail without throwing. */
export function collector(prefix) {
  const results = [];
  const t = async (name, fn) => {
    const full = prefix ? `${prefix}:${name}` : name;
    try { await fn(); results.push({ name: full, ok: true }); }
    catch (e) { results.push({ name: full, ok: false, info: String(e && e.message || e).split('\n')[0].slice(0, 220) }); }
  };
  return { t, results };
}

export function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
export function eq(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg || 'expected equal'}: got ${sa}, want ${sb}`);
}

export function sha(file) { return existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null; }

/** Common static source checks shared by both tasks. */
export function staticChecks(runDir, { dataFile, hiddenDataFile, testIds }) {
  const out = [];
  const rd = (f) => (existsSync(path.join(runDir, f)) ? readFileSync(path.join(runDir, f), 'utf8') : null);
  const html = rd('index.html'), css = rd('styles.css'), js = rd('app.js');
  out.push({ name: 'static:files-present', ok: html !== null && css !== null && js !== null && (css + js).trim().length > 0,
    info: 'index.html, styles.css and app.js must exist and be non-empty' });
  out.push({ name: 'static:data-untouched', ok: sha(path.join(runDir, dataFile)) === sha(hiddenDataFile), info: `${dataFile} must not be modified` });
  const h = html || '';
  const bad = [];
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(h)) bad.push('inline event handler');
  if (/<script(?![^>]*\bsrc=)[^>]*>\s*\S[\s\S]*?<\/script>/i.test(h)) bad.push('inline <script>');
  if (/<style[\s>]/i.test(h)) bad.push('<style> block');
  if (/<[a-z][^>]*\sstyle\s*=/i.test(h)) bad.push('inline style attribute');
  if (/(src|href)\s*=\s*["']?(https?:)?\/\//i.test(h)) bad.push('external resource');
  if (/@import\s+(url\()?["']?(https?:)?\/\//i.test(css || '')) bad.push('external @import');
  if (/url\(\s*["']?https?:\/\//i.test(css || '')) bad.push('external url() in css');
  if (/import\s*\(?\s*["']https?:\/\//i.test(js || '') || /from\s+["']https?:\/\//.test(js || '')) bad.push('external import in js');
  out.push({ name: 'static:self-contained', ok: bad.length === 0, info: bad.join(', ') || 'ok' });
  const src = h + (js || '');
  const missing = testIds.filter((id) => !src.includes(id));
  out.push({ name: 'static:testids-present', ok: missing.length === 0, info: missing.length ? 'missing: ' + missing.join(', ') : 'ok' });
  return out;
}

/** Tab through the page from the top; returns ordered list of data-testids reached (max n tabs). */
export async function tabOrder(page, n = 60) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  const seen = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      return a.getAttribute('data-testid') || (a.closest('[data-testid]') ? '(' + a.closest('[data-testid]').getAttribute('data-testid') + ')' : a.tagName.toLowerCase());
    });
    if (id === null && i > 0) break;
    seen.push(id);
  }
  return seen;
}

/** Tab from the top of the page until the active element has the given data-testid. */
export async function tabTo(page, testid, n = 60) {
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'));
    if (id === testid) return true;
  }
  return false;
}

export async function hasFocusRing(page) {
  return page.evaluate(() => {
    const a = document.activeElement; if (!a || a === document.body) return false;
    const cs = getComputedStyle(a);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    const shadow = cs.boxShadow && cs.boxShadow !== 'none';
    return outline || shadow;
  });
}

export async function noHorizontalOverflow(page, width) {
  return page.evaluate((w) => document.documentElement.scrollWidth <= w + 1 && document.body.scrollWidth <= w + 1, width);
}

async function runAxe(page) {
  await page.addScriptTag({ path: AXE_PATH });
  const res = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  }, AXE_TAGS);
  return res;
}

async function runLighthouse(url, gradeDir) {
  const { default: lighthouse } = await import(pathToFileURL(path.join(TOOLS, 'node_modules/lighthouse/core/index.js')).href);
  const { launch } = await import(pathToFileURL(path.join(TOOLS, 'node_modules/chrome-launcher/dist/index.js')).href);
  const profile = path.join(gradeDir, 'chrome-profile');
  await mkdir(profile, { recursive: true });
  const chrome = await launch({ chromePath: CHROME, userDataDir: profile,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-component-update', '--no-first-run', '--disable-sync'] });
  try {
    const res = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'silent', onlyCategories: ['performance', 'accessibility'] });
    const cats = res.lhr.categories;
    const failing = Object.values(res.lhr.audits).filter((a) => a.score !== null && a.score < 1 && cats.accessibility.auditRefs.some((r) => r.id === a.id)).map((a) => a.id);
    return { performance: Math.round((cats.performance.score ?? 0) * 100), accessibility: Math.round((cats.accessibility.score ?? 0) * 100), a11yFailing: failing.slice(0, 12), runs: 1 };
  } finally { try { await chrome.kill(); } catch {} }
}

/**
 * spec: { name, dataFile, hiddenDataFile, testIds, renderedSelector, behaviour({page, viewport, data, t, errors}), axeStates: [{name, viewport, setup(page)}] }
 */
export async function grade(spec, runDir) {
  runDir = path.resolve(runDir);
  const gradeDir = path.join(runDir, '__grade__');
  const data = JSON.parse(readFileSync(spec.hiddenDataFile, 'utf8'));
  const details = { behaviour: {}, axe: {}, lighthouse: {}, slop: {} };
  let results = staticChecks(runDir, spec);
  let rendered = false;
  let axeViolations = [];
  let lh = null;
  let slop = null;
  const origLog = console.log; console.log = (...a) => console.error(...a);
  const server = await serveDir(runDir);
  let browser;
  try {
    await mkdir(gradeDir, { recursive: true });
    browser = await launchBrowser();
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      const { page, context, errors } = await openPage(browser, viewport, server.url);
      const { t, results: r } = collector(vpName);
      const count = await page.locator(spec.renderedSelector).count();
      if (count > 0) rendered = true;
      await t('renders', async () => assert(count > 0, `no ${spec.renderedSelector} elements rendered; page errors: ${errors.join(' | ').slice(0, 200)}`));
      if (count > 0) await spec.behaviour({ page, viewport, data, t, errors, vpName });
      else for (const name of spec.behaviourNames) r.push({ name: `${vpName}:${name}`, ok: false, info: 'skipped: nothing rendered' });
      await t('no-page-errors', async () => assert(errors.length === 0, `console/page errors: ${errors.join(' | ').slice(0, 200)}`));
      results = results.concat(r);
      await context.close();
    }
    if (rendered) {
      const seen = new Map();
      for (const state of spec.axeStates) {
        const { page, context } = await openPage(browser, VIEWPORTS[state.viewport], server.url);
        try { await state.setup(page); } catch (e) { /* state setup failed: audit what is there */ }
        const v = await runAxe(page).catch((e) => [{ id: 'axe-crashed', impact: 'serious', nodes: 1, targets: [String(e.message)] }]);
        for (const x of v) { const k = x.id; const prev = seen.get(k); if (!prev || x.nodes > prev.nodes) seen.set(k, { ...x, state: state.name }); }
        await context.close();
      }
      axeViolations = [...seen.values()];
      const { collectSlopMarkers } = await import('./slop-markers.mjs');
      const { page, context } = await openPage(browser, VIEWPORTS.desktop, server.url);
      slop = await collectSlopMarkers(page).catch((e) => ({ error: String(e.message) }));
      await context.close();
    }
    await browser.close(); browser = null;
    if (rendered) lh = await runLighthouse(server.url, gradeDir).catch((e) => ({ performance: 0, accessibility: 0, runs: 0, error: String(e.message).slice(0, 200) }));
  } finally {
    if (browser) await browser.close().catch(() => {});
    await server.close();
    await rm(gradeDir, { recursive: true, force: true }).catch(() => {});
    console.log = origLog;
  }
  // A behaviour test counts once: it passes only if it passed at every viewport.
  const merged = new Map();
  for (const r of results) {
    const key = r.name.replace(/^(mobile|desktop):/, '');
    const vp = r.name.startsWith('mobile:') ? 'mobile' : r.name.startsWith('desktop:') ? 'desktop' : null;
    const prev = merged.get(key) || { name: key, ok: true, info: [] };
    if (!r.ok) { prev.ok = false; prev.info.push((vp ? vp + ': ' : '') + (r.info || 'failed')); }
    merged.set(key, prev);
  }
  results = [...merged.values()].map((r) => ({ name: r.name, ok: r.ok, info: r.info.join(' | ') }));
  const passed = results.filter((r) => r.ok).length, total = results.length;
  const behaviourScore = total ? passed / total : 0;
  const axeScore = !rendered ? 0 : axeViolations.length === 0 ? 1 : Math.max(0, 1 - axeViolations.length / 5);
  const lhOk = lh && lh.accessibility >= LH.accessibilityMin && lh.performance >= LH.performanceMin;
  const lhScore = !rendered || !lh ? 0 : lhOk ? 1 : 0.5 * Math.min(1, lh.accessibility / LH.accessibilityMin, lh.performance / LH.performanceMin);
  const score = Math.round((0.6 * behaviourScore + 0.2 * axeScore + 0.2 * lhScore) * 1000) / 1000;
  details.behaviour = { passed, total, failed: results.filter((r) => !r.ok).map((r) => r.name + (r.info ? ` — ${r.info}` : '')) };
  details.axe = { violations: axeViolations.length, component: Math.round(axeScore * 1000) / 1000, rules: axeViolations.map((v) => `${v.id}(${v.impact},${v.nodes} nodes,${v.state})`) };
  details.lighthouse = { ...(lh || { runs: 0 }), thresholds: LH, component: Math.round(lhScore * 1000) / 1000 };
  details.slop = slop || { skipped: 'nothing rendered' };
  details.rendered = rendered;
  details.weights = { behaviour: 0.6, axe: 0.2, lighthouse: 0.2 };
  return { score, passed, total, details };
}
