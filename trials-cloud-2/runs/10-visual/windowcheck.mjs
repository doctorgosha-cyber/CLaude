// Rule B exploration: at a near-zero colour threshold, is there a FULLY changed NxN block? (solid colour change vs scattered AA noise)
import fs from 'node:fs'; import path from 'node:path'; import pixelmatch from 'pixelmatch'; import { PNG } from 'pngjs';
const here = path.dirname(new URL(import.meta.url).pathname); const dir = path.join(here, 'shots', 'tuned');
function pad(p, w, h) { const d = Buffer.alloc(w * h * 4, 255); for (let y = 0; y < p.height; y++) p.data.copy(d, y * w * 4, y * p.width * 4, (y + 1) * p.width * 4); p.data = d; p.width = w; p.height = h; }
console.log('key\tthr\twin8(max64)\twin16(max256)\twin32(max1024)');
for (const id of ['U1', 'U2', 'U3', 'U4', 'C1', 'C2']) for (const width of [390, 1280]) for (const t of [0.002, 0.005, 0.01]) {
  const p1 = PNG.sync.read(fs.readFileSync(path.join(dir, `${id}-${width}-before.png`))), p2 = PNG.sync.read(fs.readFileSync(path.join(dir, `${id}-${width}-after.png`)));
  const w = Math.max(p1.width, p2.width), h = Math.max(p1.height, p2.height); pad(p1, w, h); pad(p2, w, h);
  const r = [8, 16, 32].map(n => pixelmatch(p1.data, p2.data, null, w, h, { threshold: t, windowSize: n }));
  console.log(`${id}-${width}\t${t}\t${r.join('\t')}`);
}
