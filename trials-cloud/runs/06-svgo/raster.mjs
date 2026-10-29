// Rasterise originals + optimised SVGs at 512 px in headless Chromium and pixel-diff them. Usage: node raster.mjs <fixturesIn> <outDefault> <outTuned> <pngDir>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(process.env.SVGO_TOOLS + '/package.json');
const { PNG } = req('pngjs');
const pixelmatch = (await import(process.env.SVGO_TOOLS + '/node_modules/pixelmatch/index.js')).default;
const { chromium } = await import(process.env.AXE_TOOLS + '/node_modules/playwright-core/index.mjs');

const [inDir, defDir, tunedDir, pngDir] = process.argv.slice(2);
fs.mkdirSync(pngDir, { recursive: true });
const W = 512;
const browser = await chromium.launch({ executablePath: process.env.CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: W, height: W }, deviceScaleFactor: 1 });

async function shot(svgPath, outPng, seekMs) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  // inline the SVG so <style>, ids, CSS animations and SMIL behave as on the real site; CSS width forces 512 px, height follows viewBox
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{width:${W}px;height:auto;display:block}</style></head><body>${svg}</body></html>`);
  await page.evaluate((t) => {
    const s = document.querySelector('svg');
    try { s.pauseAnimations(); s.setCurrentTime(t / 1000); } catch {}
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
  }, seekMs);
  await page.waitForTimeout(50);
  const el = await page.$('svg');
  const box = await el.boundingBox();
  await page.screenshot({ path: outPng, clip: { x: 0, y: 0, width: W, height: Math.max(1, Math.round(box.height)) } });
  return box;
}
function diff(aPath, bPath, outPath) {
  const a = PNG.sync.read(fs.readFileSync(aPath)); const b = PNG.sync.read(fs.readFileSync(bPath));
  if (a.width !== b.width || a.height !== b.height) return { pct: 100, note: `size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  const d = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.1 });
  fs.writeFileSync(outPath, PNG.sync.write(d));
  return { pct: +((100 * n) / (a.width * a.height)).toFixed(3), differing: n, total: a.width * a.height };
}

const result = {};
for (const f of fs.readdirSync(inDir).filter((x) => x.endsWith('.svg')).sort()) {
  const base = f.replace(/\.svg$/, '');
  const times = f.includes('animated') ? [0, 400] : [0];
  result[f] = {};
  for (const t of times) {
    const tag = times.length > 1 ? `-t${t}` : '';
    const o = path.join(pngDir, `${base}${tag}-orig.png`);
    await shot(path.join(inDir, f), o, t);
    for (const [label, dir] of [['default', defDir], ['tuned', tunedDir]]) {
      const p = path.join(pngDir, `${base}${tag}-${label}.png`);
      await shot(path.join(dir, f), p, t);
      result[f][`${label}${tag}`] = diff(o, p, path.join(pngDir, `${base}${tag}-${label}-diff.png`));
    }
  }
}
await browser.close();
console.log(JSON.stringify(result, null, 1));
