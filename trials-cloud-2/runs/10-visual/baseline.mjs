// BASELINE = what the team does today: take two screenshots, a human eyeballs them side by side.
// This script only produces the screenshots (and a side-by-side PNG per pair/width) in baseline/; it reports no diff.
import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright-core'; import { PNG } from 'pngjs';
const here = path.dirname(new URL(import.meta.url).pathname);
const FIX = path.resolve(here, '../../fixtures/10-visual'); const OUT = path.join(here, 'baseline'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const t0 = performance.now();
for (const id of ['U1', 'U2', 'U3', 'U4', 'C1', 'C2']) for (const width of [390, 1280]) {
  const imgs = [];
  for (const side of ['before', 'after']) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(`file://${FIX}/${side}/${id}.html`);
    const f = path.join(OUT, `${id}-${width}-${side}.png`); await page.screenshot({ path: f, fullPage: true }); await page.close();
    imgs.push(PNG.sync.read(fs.readFileSync(f)));
  }
  const W = imgs[0].width + imgs[1].width + 20, H = Math.max(imgs[0].height, imgs[1].height);
  const sbs = new PNG({ width: W, height: H }); sbs.data.fill(128);
  let x0 = 0; for (const im of imgs) { for (let y = 0; y < im.height; y++) im.data.copy(sbs.data, (y * W + x0) * 4, y * im.width * 4, (y + 1) * im.width * 4); x0 += im.width + 20; }
  fs.writeFileSync(path.join(OUT, `${id}-${width}-side-by-side.png`), PNG.sync.write(sbs));
  console.log(`${id}-${width}: open ${OUT}/${id}-${width}-side-by-side.png and look for differences (manual)`);
}
await browser.close();
console.log('baseline capture seconds', ((performance.now() - t0) / 1000).toFixed(1), '+ human review time (not measured)');
