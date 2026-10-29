// Encodes every fixtures/06-images/src/*.png with sharp (webp/avif, default + tuned), cwebp, avifenc
// and the JPEG-80 baseline; writes out/<encoder>/<img>_q<q>.<ext>, decodes each to out/decoded/*.png
// via sharp, and writes bench.json (bytes + encode ms per file). SSIM is computed by ssim.py afterwards.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
const SRC = '/home/user/CLaude/trials-cloud-2/fixtures/06-images/src';
const OUT = '/home/user/CLaude/trials-cloud-2/runs/06-images/out';
const QS = [50, 60, 70, 80, 90];
const isText = n => n.startsWith('banner_') || n.startsWith('flat_');
const cli = (cmd, args) => { const t = performance.now(); const r = spawnSync(cmd, args, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(cmd + ' ' + r.stderr); return performance.now() - t; };
// each encoder: (srcPath, buf, q, name, outPath) -> ms
const ENC = {
  'jpeg-sharp':        { ext: 'jpg',  fn: async (s, b, q) => sharp(b).jpeg({ quality: q }).toBuffer() },
  'sharp-webp':        { ext: 'webp', fn: async (s, b, q) => sharp(b).webp({ quality: q, effort: 4 }).toBuffer() },
  'sharp-webp-tuned':  { ext: 'webp', fn: async (s, b, q) => sharp(b).webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer() },
  'sharp-avif':        { ext: 'avif', fn: async (s, b, q) => sharp(b).avif({ quality: q, effort: 4 }).toBuffer() },
  'sharp-avif-tuned':  { ext: 'avif', fn: async (s, b, q, n) => sharp(b).avif({ quality: q, effort: 4, chromaSubsampling: isText(n) ? '4:4:4' : '4:2:0' }).toBuffer() },
  'cwebp':             { ext: 'webp', cli: (s, q, n, o) => cli('cwebp', ['-quiet', '-q', String(q), '-m', '4', s, '-o', o]) },
  'cwebp-tuned':       { ext: 'webp', cli: (s, q, n, o) => cli('cwebp', ['-quiet', '-q', String(q), '-m', '6', '-sharp_yuv', s, '-o', o]) },
  'avifenc':           { ext: 'avif', cli: (s, q, n, o) => cli('avifenc', ['-q', String(q), s, o]) },                       // tool defaults: speed 6, yuv auto (=444 for RGB PNG)
  'avifenc-tuned':     { ext: 'avif', cli: (s, q, n, o) => cli('avifenc', ['-q', String(q), '-y', isText(n) ? '444' : '420', s, o]) },
};
const rows = [];
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort();
for (const f of files) {
  const name = f.replace(/\.png$/, ''); const srcPath = path.join(SRC, f); const buf = fs.readFileSync(srcPath);
  const meta = await sharp(buf).metadata();
  rows.push({ encoder: 'png-source', image: name, q: null, bytes: buf.length, ms: 0, file: srcPath, width: meta.width, height: meta.height });
  for (const [enc, spec] of Object.entries(ENC)) {
    fs.mkdirSync(path.join(OUT, enc), { recursive: true });
    for (const q of QS) {
      if (enc === 'jpeg-sharp' && q !== 80) continue; // baseline only at 80
      const outPath = path.join(OUT, enc, `${name}_q${q}.${spec.ext}`);
      let ms;
      if (spec.cli) ms = spec.cli(srcPath, q, name, outPath);
      else { const t = performance.now(); const o = await spec.fn(srcPath, buf, q, name); ms = performance.now() - t; fs.writeFileSync(outPath, o); }
      rows.push({ encoder: enc, image: name, q, bytes: fs.statSync(outPath).size, ms: +ms.toFixed(1), file: outPath });
    }
  }
  console.log('encoded', name);
}
// decode everything with sharp to PNG so the metric sees the same decoder for every encoder
fs.mkdirSync(path.join(OUT, 'decoded'), { recursive: true });
for (const r of rows) {
  if (r.encoder === 'png-source') continue;
  const dec = path.join(OUT, 'decoded', `${r.encoder}__${r.image}_q${r.q}.png`);
  await sharp(r.file).removeAlpha().png().toFile(dec); r.decoded = dec;
}
fs.writeFileSync(path.join(OUT, '..', 'bench.json'), JSON.stringify(rows, null, 1));
console.log('rows', rows.length);
