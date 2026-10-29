#!/usr/bin/env node
// checks/visual.mjs — visual regression for a before/after page pair (files or URLs).
// Usage: node checks/visual.mjs <before> <after> [--widths 390,1280] [--mask sel1,sel2] [--threshold 0.3]
//        [--max-pixels 20] [--solid-check 1|0] [--out dir] [--chrome path]
// Exit 0 = no change above threshold, 1 = change found, 2 = tool error. Prints JSON.
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright-core'; import pixelmatch from 'pixelmatch'; import { PNG } from 'pngjs';
const a = process.argv.slice(2); const opt = { widths: '390,1280', mask: '[data-dynamic]', threshold: '0.3', 'max-pixels': '20', 'solid-check': '1', out: 'visual-out', chrome: process.env.CHROME_PATH || '' };
const pos = []; for (let i = 0; i < a.length; i++) a[i].startsWith('--') ? (opt[a[i].slice(2)] = a[++i]) : pos.push(a[i]);
if (pos.length !== 2) { console.error('usage: visual.mjs <before> <after> [options]'); process.exit(2); }
const toUrl = s => /^https?:/.test(s) ? s : 'file://' + path.resolve(s);
const pad = (p, w, h) => { const d = Buffer.alloc(w * h * 4, 255); for (let y = 0; y < p.height; y++) p.data.copy(d, y * w * 4, y * p.width * 4, (y + 1) * p.width * 4); p.data = d; p.width = w; p.height = h; };
const bbox = (d, w, h) => { let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
try {
  fs.mkdirSync(opt.out, { recursive: true });
  const browser = await chromium.launch(opt.chrome ? { executablePath: opt.chrome } : {});
  const masks = opt.mask ? opt.mask.split(',').filter(Boolean) : []; const results = []; let changed = false;
  for (const width of opt.widths.split(',').map(Number)) {
    const shots = [];
    for (const [side, src] of [['before', pos[0]], ['after', pos[1]]]) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage(); await page.goto(toUrl(src), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready); await page.addStyleTag({ content: '*{caret-color:transparent!important}' });
      const file = path.join(opt.out, `${side}-${width}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled', mask: masks.map(s => page.locator(s)), maskColor: '#FF00FF' });
      await ctx.close(); shots.push(PNG.sync.read(fs.readFileSync(file)));
    }
    const [p1, p2] = shots; const w = Math.max(p1.width, p2.width), h = Math.max(p1.height, p2.height);
    const sizeMismatch = p1.width !== p2.width || p1.height !== p2.height; if (sizeMismatch) { pad(p1, w, h); pad(p2, w, h); }
    const out = new PNG({ width: w, height: h });
    const n = pixelmatch(p1.data, p2.data, out.data, w, h, { threshold: Number(opt.threshold), diffMask: true });
    const solid = opt['solid-check'] === '1' ? pixelmatch(p1.data, p2.data, null, w, h, { threshold: 0.005, windowSize: 16 }) : 0;
    const diffPath = path.join(opt.out, `diff-${width}.png`); fs.writeFileSync(diffPath, PNG.sync.write(out));
    const fail = n > Number(opt['max-pixels']) || solid >= 256;
    changed ||= fail;
    results.push({ width, size: [w, h], sizeMismatch, diffPixels: n, pctDiff: +(100 * n / (w * h)).toFixed(4), bbox: bbox(out.data, w, h), solidBlock16: solid, changed: fail, diff: diffPath });
  }
  await browser.close();
  console.log(JSON.stringify({ before: pos[0], after: pos[1], threshold: Number(opt.threshold), maxPixels: Number(opt['max-pixels']), masks, changed, results }, null, 1));
  process.exit(changed ? 1 : 0);
} catch (e) { console.log(JSON.stringify({ error: String(e.message || e) })); process.exit(2); }
