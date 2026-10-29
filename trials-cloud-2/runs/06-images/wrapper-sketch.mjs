#!/usr/bin/env node
// checks/images.mjs  —  node checks/images.mjs <srcDir> [--out dir] [--avif] [--webp-q 80] [--avif-q 60] [--min-ssim 0.97]
// Converts every PNG/JPEG in <srcDir> to WebP (and AVIF with --avif) via sharp@0.35.5, then re-decodes each output and
// computes RGB SSIM (scikit-image-compatible: uniform 7x7 window, sample covariance, mean over 3 channels) against the
// source. Prints JSON. Exit 0 = every output >= min-ssim, 1 = at least one output below (file kept, listed), 2 = tool error.
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i < 0 ? d : a[i + 1]; };
const src = a.find(x => !x.startsWith('--') && a[a.indexOf(x) - 1]?.startsWith('--') !== true) ;
const out = opt('--out', path.join(src ?? '.', '_out')), doAvif = a.includes('--avif');
const webpQ = +opt('--webp-q', 80), avifQ = +opt('--avif-q', 60), minSsim = +opt('--min-ssim', 0.97);
function ssimRGB(x, y, w, h) {                       // x,y: raw RGB Uint8Array, same w*h
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, R = 3, NP = 49, cn = NP / (NP - 1), W = w + 1;
  const integ = f => { const I = new Float64Array(W * (h + 1)); for (let r = 1; r <= h; r++) { let s = 0; for (let c = 1; c <= w; c++) { s += f((r - 1) * w + c - 1); I[r * W + c] = I[(r - 1) * W + c] + s; } } return I; };
  const box = (I, r, c) => I[(r + R + 1) * W + c + R + 1] - I[(r - R) * W + c + R + 1] - I[(r + R + 1) * W + c - R] + I[(r - R) * W + c - R];
  let total = 0;
  for (let ch = 0; ch < 3; ch++) {
    const X = i => x[i * 3 + ch], Y = i => y[i * 3 + ch];
    const Ix = integ(X), Iy = integ(Y), Ixx = integ(i => X(i) * X(i)), Iyy = integ(i => Y(i) * Y(i)), Ixy = integ(i => X(i) * Y(i));
    let s = 0, n = 0;
    for (let r = R; r < h - R; r++) for (let c = R; c < w - R; c++) {
      const ux = box(Ix, r, c) / NP, uy = box(Iy, r, c) / NP, vx = cn * (box(Ixx, r, c) / NP - ux * ux), vy = cn * (box(Iyy, r, c) / NP - uy * uy), vxy = cn * (box(Ixy, r, c) / NP - ux * uy);
      s += ((2 * ux * uy + C1) * (2 * vxy + C2)) / ((ux * ux + uy * uy + C1) * (vx + vy + C2)); n++;
    }
    total += s / n;
  }
  return total / 3;
}
const raw = async input => { const { data, info } = await sharp(input).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; };
try {
  if (!src || !fs.statSync(src).isDirectory()) throw new Error('usage: images.mjs <srcDir> [--out d] [--avif] [--webp-q n] [--avif-q n] [--min-ssim x]');
  fs.mkdirSync(out, { recursive: true });
  const files = fs.readdirSync(src).filter(f => /\.(png|jpe?g)$/i.test(f)).sort(), results = [], t0 = Date.now();
  for (const f of files) {
    const inPath = path.join(src, f), base = f.replace(/\.(png|jpe?g)$/i, ''), s = await raw(inPath), row = { file: f, src_bytes: fs.statSync(inPath).size, outputs: {} };
    const targets = [['webp', sharp(inPath).webp({ quality: webpQ, effort: 4 }), webpQ], ...(doAvif ? [['avif', sharp(inPath).avif({ quality: avifQ, effort: 4 }), avifQ]] : [])];
    for (const [ext, pipe, q] of targets) {
      const o = path.join(out, `${base}.${ext}`); const t = Date.now(); await pipe.toFile(o); const d = await raw(o);
      const ssim = +ssimRGB(s.data, d.data, s.w, s.h).toFixed(4);
      row.outputs[ext] = { path: o, q, bytes: fs.statSync(o).size, ssim, ok: ssim >= minSsim, ms: Date.now() - t };
    }
    results.push(row);
  }
  const failed = results.flatMap(r => Object.entries(r.outputs).filter(([, o]) => !o.ok).map(([k, o]) => ({ file: r.file, format: k, ssim: o.ssim })));
  console.log(JSON.stringify({ tool: 'sharp@0.35.5', settings: { webpQ, avifQ: doAvif ? avifQ : null, minSsim, effort: 4 }, files: results.length, failed, results, seconds: (Date.now() - t0) / 1000 }, null, 1));
  process.exit(failed.length ? 1 : 0);
} catch (e) { console.log(JSON.stringify({ error: String(e.message || e) })); process.exit(2); }
