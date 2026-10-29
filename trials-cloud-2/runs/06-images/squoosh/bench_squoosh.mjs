// @squoosh/lib 0.5.3 on Node 22 needs: node --no-experimental-global-navigator --no-experimental-fetch
// webp: quality q (method 4 default; tuned method 6 + use_sharp_yuv); avif: cqLevel = round(63*(100-q)/100) (squoosh has no 0-100 quality knob), speed 6 default
import { ImagePool } from '@squoosh/lib';
import sharp from '../node_modules/sharp/lib/index.js';
import fs from 'node:fs'; import path from 'node:path'; import { performance } from 'node:perf_hooks';
const SRC = '/home/user/CLaude/trials-cloud-2/fixtures/06-images/src';
const OUT = '/home/user/CLaude/trials-cloud-2/runs/06-images/out';
const QS = [50, 60, 70, 80, 90];
const isText = n => n.startsWith('banner_') || n.startsWith('flat_');
const pool = new ImagePool(1); const rows = [];
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort()) {
  const name = f.replace(/\.png$/, ''); const buf = fs.readFileSync(path.join(SRC, f));
  for (const q of QS) {
    const cq = Math.round(63 * (100 - q) / 100);
    const cfgs = {
      'squoosh-webp':       { webp: { quality: q, method: 4 } },
      'squoosh-webp-tuned': { webp: { quality: q, method: 6, use_sharp_yuv: 1 } },
      'squoosh-avif':       { avif: { cqLevel: cq, speed: 6 } },
      'squoosh-avif-tuned': { avif: { cqLevel: cq, speed: 6, subsample: isText(name) ? 3 : 1 } }, // 3 = 4:4:4, 1 = 4:2:0
    };
    for (const [enc, opt] of Object.entries(cfgs)) {
      const img = pool.ingestImage(buf); await img.decoded;
      const t = performance.now(); await img.encode(opt);
      const k = Object.keys(opt)[0]; const res = await img.encodedWith[k]; const ms = performance.now() - t;
      fs.mkdirSync(path.join(OUT, enc), { recursive: true });
      const outPath = path.join(OUT, enc, `${name}_q${q}.${k}`); fs.writeFileSync(outPath, res.binary);
      const dec = path.join(OUT, 'decoded', `${enc}__${name}_q${q}.png`); await sharp(outPath).removeAlpha().png().toFile(dec);
      rows.push({ encoder: enc, image: name, q, bytes: res.binary.length, ms: +ms.toFixed(1), file: outPath, decoded: dec, note: k === 'avif' ? `cqLevel=${cq}` : undefined });
    }
  }
  console.log('squoosh encoded', name);
}
await pool.close();
fs.writeFileSync('/home/user/CLaude/trials-cloud-2/runs/06-images/bench_squoosh.json', JSON.stringify(rows, null, 1));
console.log('rows', rows.length);
