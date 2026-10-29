#!/usr/bin/env node
// checks/axe.mjs — run axe-core (WCAG 2.x A/AA tags) on local HTML files or URLs with headless Chromium.
// Usage: node checks/axe.mjs <file-or-url>... [--all-rules] [--chrome=/path/to/chrome]
// Exit 0 when no violations, 1 when violations, 2 when a page could not be loaded. Prints JSON.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');   // MPL-2.0, unmodified
const args = process.argv.slice(2);
const chrome = (args.find(a => a.startsWith('--chrome=')) ?? '').slice(9) || undefined;
const options = args.includes('--all-rules') ? {} : { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } };
const targets = args.filter(a => !a.startsWith('--')).map(t => /^https?:/.test(t) ? t : 'file://' + resolve(t));
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = { ok: true, axe: require('axe-core/package.json').version, pages: [] };
let exit = 0;
for (const url of targets) {
  try { await page.goto(url, { waitUntil: 'load' }); } catch (e) { report.pages.push({ url, error: String(e.message) }); exit = 2; continue; }
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(o => axe.run(document, o), options);
  const violations = r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => n.target.join(' ')).slice(0, 5) }));
  const incomplete = r.incomplete.map(v => v.id);
  report.pages.push({ url, violations, incomplete });
  if (violations.length) { report.ok = false; exit = exit || 1; }
}
await browser.close();
console.log(JSON.stringify(report, null, 2));
process.exit(exit);
