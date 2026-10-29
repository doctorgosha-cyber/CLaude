// Baseline: what NEXUS does today — unlabelled inputs, tap targets < 24 px, outline:none rules.
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const dirs = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const out = {}; const t0 = Date.now();
for (const d of dirs) for (const f of readdirSync(d).filter(x => x.endsWith('.html'))) {
  await page.goto('file://' + resolve(d, f));
  const findings = await page.evaluate(() => {
    const r = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]),select,textarea')) {
      const labelled = el.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title');
      if (!labelled) r.push({ check: 'unlabelled-input', target: el.outerHTML.slice(0, 60) });
    }
    for (const el of document.querySelectorAll('button,input:not([type=hidden]),select,[role=button],a.btn')) {
      const b = el.getBoundingClientRect(); if (b.width && b.height && (b.width < 24 || b.height < 24)) r.push({ check: 'tap-target', target: el.outerHTML.slice(0, 60), w: b.width, h: b.height });
    }
    for (const s of document.styleSheets) { try { for (const rule of s.cssRules) if (/outline\s*:\s*(none|0)/.test(rule.cssText)) r.push({ check: 'outline-none', target: rule.selectorText }); } catch {} }
    return r;
  });
  out[`${d}/${f}`] = findings;
}
await browser.close();
console.log(JSON.stringify({ runtime_s: (Date.now() - t0) / 1000, files: out }, null, 1));
