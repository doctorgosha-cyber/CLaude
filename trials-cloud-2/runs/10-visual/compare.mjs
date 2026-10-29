// Re-compare captured PNGs (shots/<mode>) across a threshold grid; no browser. Usage: node compare.mjs <mode>
import fs from 'node:fs'; import path from 'node:path';
import pixelmatch from 'pixelmatch'; import { PNG } from 'pngjs';
const mode = process.argv[2] || 'default';
const here = path.dirname(new URL(import.meta.url).pathname);
const dir = path.join(here, 'shots', mode);
const grid = [0.3, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0];
function pad(p, w, h) { const d = Buffer.alloc(w * h * 4, 255); for (let y = 0; y < p.height; y++) p.data.copy(d, y * w * 4, y * p.width * 4, (y + 1) * p.width * 4); p.data = d; p.width = w; p.height = h; }
const rows = [];
for (const id of ['U1', 'U2', 'U3', 'U4', 'C1', 'C2']) for (const width of [390, 1280]) {
  const p1 = PNG.sync.read(fs.readFileSync(path.join(dir, `${id}-${width}-before.png`)));
  const p2 = PNG.sync.read(fs.readFileSync(path.join(dir, `${id}-${width}-after.png`)));
  const w = Math.max(p1.width, p2.width), h = Math.max(p1.height, p2.height); pad(p1, w, h); pad(p2, w, h);
  const row = { key: `${id}-${width}` };
  for (const t of grid) {
    row[`t${t}`] = pixelmatch(p1.data, p2.data, null, w, h, { threshold: t });
    row[`t${t}_AA`] = pixelmatch(p1.data, p2.data, null, w, h, { threshold: t, includeAA: true });
    row[`t${t}_win16`] = pixelmatch(p1.data, p2.data, null, w, h, { threshold: t, windowSize: 16 });
  }
  rows.push(row);
}
const cols = Object.keys(rows[0]);
console.log(cols.join('\t')); for (const r of rows) console.log(cols.map(c => r[c]).join('\t'));
fs.writeFileSync(path.join(here, `grid-${mode}.json`), JSON.stringify(rows, null, 1));
