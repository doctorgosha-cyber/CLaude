// Candidate: axe-core injected via playwright-core. Usage: node axe-run.mjs <config:default|tuned> <dir>...
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const [config, ...dirs] = process.argv.slice(2);
const options = config === 'tuned'
  ? { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }
  : {};
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const out = {}; const t0 = Date.now();
for (const d of dirs) for (const f of readdirSync(d).filter(x => x.endsWith('.html'))) {
  await page.goto('file://' + resolve(d, f));
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(async (o) => { const r = await axe.run(document, o); return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.[0] })); }, options);
  out[`${d}/${f}`] = res;
}
await browser.close();
console.log(JSON.stringify({ config, axe_version: require('axe-core/package.json').version, runtime_s: (Date.now() - t0) / 1000, files: out }, null, 1));
