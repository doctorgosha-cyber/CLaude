// Trial 10-visual harness. Usage: node run.mjs <mode> [threshold]
// mode: default | tuned | strict(includeAA:true, reporting only)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const mode = process.argv[2] || 'default';
const THR = process.argv[3] !== undefined ? Number(process.argv[3]) : 0.1;
const here = path.dirname(new URL(import.meta.url).pathname);
const FIX = path.resolve(here, '../../fixtures/10-visual');
const OUT = path.join(here, 'shots', mode); const DIFF = path.join(here, 'diffs', mode);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(DIFF, { recursive: true });
const IDS = ['U1', 'U2', 'U3', 'U4', 'C1', 'C2'];
const WIDTHS = [390, 1280];
const tuned = mode === 'tuned';
const MASK = ['[data-dynamic]'];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

async function shoot(file, width, out) {
  const ctx = await browser.newContext(tuned
    ? { viewport: { width, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }
    : { viewport: { width, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('file://' + file, { waitUntil: 'load' });
  if (tuned) {
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '*{caret-color:transparent!important}' });
  }
  const opts = { path: out, fullPage: true };
  if (tuned) { opts.animations = 'disabled'; opts.mask = MASK.map(s => page.locator(s)); opts.maskColor = '#FF00FF'; }
  await page.screenshot(opts);
  await ctx.close();
}

function pad(p, w, h) { // extend image to w x h with opaque white
  const d = Buffer.alloc(w * h * 4, 255);
  for (let y = 0; y < p.height; y++) p.data.copy(d, y * w * 4, y * p.width * 4, (y + 1) * p.width * 4);
  p.data = d; p.width = w; p.height = h;
}
function bbox(diff, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (diff[i + 3] !== 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

const results = {};
for (const id of IDS) {
  for (const width of WIDTHS) {
    const t0 = performance.now();
    const b = path.join(OUT, `${id}-${width}-before.png`), a = path.join(OUT, `${id}-${width}-after.png`);
    await shoot(path.join(FIX, 'before', `${id}.html`), width, b);
    await shoot(path.join(FIX, 'after', `${id}.html`), width, a);
    const tShot = performance.now();
    const p1 = PNG.sync.read(fs.readFileSync(b)), p2 = PNG.sync.read(fs.readFileSync(a));
    let r;
    const sizeMismatch = (p1.width !== p2.width || p1.height !== p2.height) ? { before: [p1.width, p1.height], after: [p2.width, p2.height] } : null;
    {
      const w = Math.max(p1.width, p2.width), h = Math.max(p1.height, p2.height);
      if (sizeMismatch) { pad(p1, w, h); pad(p2, w, h); }
      const out = new PNG({ width: w, height: h });
      const opts = { threshold: THR, diffMask: true, includeAA: mode === 'strict' };
      const n = pixelmatch(p1.data, p2.data, out.data, w, h, opts);
      const nAA = pixelmatch(p1.data, p2.data, null, w, h, { threshold: THR, includeAA: true });
      const nWin = pixelmatch(p1.data, p2.data, null, w, h, { threshold: THR, windowSize: 16 });
      fs.writeFileSync(path.join(DIFF, `${id}-${width}.png`), PNG.sync.write(out));
      r = { id, width, size: [w, h], diffPixels: n, diffPixelsInclAA: nAA, maxWindow16: nWin,
        pct: +(100 * n / (w * h)).toFixed(4), bbox: bbox(out.data, w, h), sizeMismatch };
    }
    r.shot_s = +((tShot - t0) / 1000).toFixed(2); r.compare_s = +((performance.now() - tShot) / 1000).toFixed(2);
    r.total_s = +((performance.now() - t0) / 1000).toFixed(2);
    results[`${id}-${width}`] = r;
    console.log(JSON.stringify(r));
  }
}
await browser.close();
fs.writeFileSync(path.join(here, `pixelmatch-${mode}-thr${THR}.json`), JSON.stringify({ mode, threshold: THR, results }, null, 1));
