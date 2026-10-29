// Generates task/ (the slow site) and hidden/expected.json. Deterministic.
// Usage: node gen/gen.mjs   (run from fixtures/11-perf)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TASK = path.join(ROOT, 'task');
const HIDDEN = path.join(ROOT, 'hidden');

// ---------- deterministic PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- PNG writer (pure Node) ----------
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}
function writePng(file, w, h, pixel, level = 6) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}
const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;

function heroPixel(w, h, rnd, noise) {
  return (x, y) => {
    const u = x / w, v = y / h;
    // warm wood gradient with soft "headphone" ellipses
    let r = 120 + 70 * u + 20 * v, g = 80 + 40 * u + 25 * v, b = 50 + 25 * u + 20 * v;
    for (let i = 0; i < 6; i++) {
      const cx = 0.12 + i * 0.15, cy = 0.5 + 0.18 * Math.sin(i * 1.7);
      const d = ((u - cx) ** 2) / 0.004 + ((v - cy) ** 2) / 0.02;
      if (d < 1) { const k = 1 - d; r = r * (1 - k) + 30 * k; g = g * (1 - k) + 32 * k; b = b * (1 - k) + 36 * k; }
    }
    const n = (rnd() - 0.5) * noise;
    return [clamp(r + n), clamp(g + (rnd() - 0.5) * noise), clamp(b + (rnd() - 0.5) * noise)];
  };
}

// ---------- catalogue ----------
// Deliberate ties: price 199 (idx 2 vs 9), 349 (idx 5,14,20), 129 (idx 7,16), 899 (idx 3,11);
// rating 4.6 ties (idx 5, 14, 18). Catalogue order differs from the tie-break order.
const CATALOGUE = [
  ['Aero 2 ANC',        'Nordlys', 279.00, 4.7, 41, 254],
  ['Studio One',        'Acme',    159.00, 4.0, 30, 268],
  ['Aero Lite',         'Nordlys', 199.00, 4.1, 36, 221],
  ['Zenith',            'Orbita',  899.00, 4.7, 24, 330],
  ['Wing',              'Kestrel', 279.00, 4.6, 38, 240],
  ['Halo',              'Orbita',  349.00, 4.6, 32, 275],
  ['Pulse Go',          'Tundra',   89.00, 3.6, 28, 198],
  ['Pebble',            'Tundra',  129.00, 3.9, 25, 189],
  ['Flux',              'Kestrel', 329.00, 4.3, 35, 262],
  ['Flux Mini',         'Kestrel', 199.00, 4.4, 30, 205],
  ['Quiet Mark II',     'Acme',    449.00, 4.5, 29, 290],
  ['Signature',         'Vellum',  899.00, 4.9, 20, 345],
  ['Trail',             'Tundra',  149.00, 3.8, 45, 230],
  ['Orbit X',           'Orbita',  599.00, 4.4, 26, 310],
  ['Studio Pro',        'Acme',    349.00, 4.6, 34, 280],
  ['Solace',            'Vellum',  499.00, 4.5, 30, 300],
  ['Drift',             'Vellum',  129.00, 4.2, 33, 210],
  ['Nimbus',            'Nordlys', 429.00, 4.5, 40, 258],
  ['Kite',              'Kestrel', 249.00, 4.6, 27, 215],
  ['Summit',            'Tundra',  379.00, 4.2, 50, 320],
  ['Borealis',          'Nordlys', 349.00, 4.8, 44, 266],
  ['Studio Go',         'Acme',     99.00, 3.7, 22, 195],
  ['Halo Lite',         'Orbita',  229.00, 4.3, 30, 238],
  ['Polar',             'Nordlys',  69.00, 3.4, 20, 180],
];
const products = CATALOGUE.map((p, i) => ({
  id: 101 + i * 7, name: p[0], brand: p[1], price: p[2], rating: p[3], battery_h: p[4], weight_g: p[5]
}));

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
for (const d of ['css', 'js/vendor', 'img', 'fonts', 'data']) fs.mkdirSync(path.join(TASK, d), { recursive: true });
fs.mkdirSync(HIDDEN, { recursive: true });

// data files
rmrf(path.join(TASK, 'data'));
fs.mkdirSync(path.join(TASK, 'data'));
fs.writeFileSync(path.join(TASK, 'data', 'products.json'),
  JSON.stringify(products.map(p => ({ id: p.id, name: p.name })), null, 2) + '\n');
for (const p of products) {
  fs.writeFileSync(path.join(TASK, 'data', `product-${p.id}.json`),
    JSON.stringify({ brand: p.brand, price: p.price, rating: p.rating, battery_h: p.battery_h, weight_g: p.weight_g }, null, 2) + '\n');
}

// ---------- images ----------
const rnd = mulberry32(20261029);
let size = writePng(path.join(TASK, 'img', 'hero.png'), 1800, 1000, heroPixel(1800, 1000, rnd, 3.6));
console.log('hero.png', size);
for (let i = 1; i <= 4; i++) {
  const r2 = mulberry32(100 + i);
  const w = 900, h = 675;
  size = writePng(path.join(TASK, 'img', `related-${i}.png`), w, h, (x, y) => {
    const u = x / w, v = y / h;
    const base = [[60, 90, 140], [140, 70, 90], [70, 130, 100], [130, 110, 60]][i - 1];
    const d = Math.hypot(u - 0.5, (v - 0.5) * 0.75);
    const k = d < 0.3 ? 1 - d / 0.3 : 0;
    const n = () => (r2() - 0.5) * 1.5;
    return [clamp(base[0] + 60 * u + 40 * k + n()), clamp(base[1] + 40 * v + 40 * k + n()), clamp(base[2] + 30 * (1 - u) + 40 * k + n())];
  });
  console.log(`related-${i}.png`, size);
}
for (let i = 1; i <= 5; i++) {
  const w = 400, h = 400;
  const hue = [[220, 120, 60], [60, 160, 120], [120, 80, 180], [200, 60, 100], [40, 120, 200]][i - 1];
  size = writePng(path.join(TASK, 'img', `avatar-${i}.png`), w, h, (x, y) => {
    const d = Math.hypot(x - 200, y - 200);
    if (d > 190) return [245, 246, 248];
    const k = d / 190;
    return [clamp(hue[0] * (1 - 0.4 * k)), clamp(hue[1] * (1 - 0.4 * k)), clamp(hue[2] * (1 - 0.4 * k))];
  });
  console.log(`avatar-${i}.png`, size);
}

// ---------- fonts (DejaVu, Bitstream Vera licence — unmodified copies) ----------
for (const f of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif.ttf', 'DejaVuSansMono.ttf']) {
  fs.copyFileSync(path.join('/usr/share/fonts/truetype/dejavu', f), path.join(TASK, 'fonts', f));
}
fs.copyFileSync('/usr/share/doc/fonts-dejavu-core/copyright', path.join(TASK, 'fonts', 'LICENSE-DejaVu.txt'));

// ---------- vendored "analytics" bundle (~300 KB of generated, valid JS) ----------
{
  const r = mulberry32(7);
  const words = ['session', 'pixel', 'cohort', 'funnel', 'beacon', 'attribution', 'variant', 'segment', 'consent', 'rollup', 'bucket', 'hash', 'dedupe', 'heartbeat', 'batch'];
  let js = '/*! tq-analytics 4.18.2 | internal build, do not edit */\n;(function(w,d){"use strict";var R={},S=[];\n';
  let n = 0;
  while (js.length < 300 * 1024) {
    const a = words[Math.floor(r() * words.length)], b = words[Math.floor(r() * words.length)];
    const c1 = Math.floor(r() * 9000) + 1, c2 = Math.floor(r() * 977) + 3;
    js += `function ${a}_${b}_${n}(a,b){var r=${c1},i=0;for(;i<${c2 % 7 + 1};i++){r=(r*31+(a|0)+(b|0)*i)%${c2 * 1000 + 7};}if(r>${c1 >> 1}){r=r-${c1 >> 2};}return r;}\nR.${a}_${b}_${n}=${a}_${b}_${n};S.push("${a}-${b}-${c1.toString(16)}-${c2.toString(36)}");\n`;
    n++;
  }
  js += 'w.__tqRegistry=R;w.__tqStrings=S;w.__tqQueue=w.__tqQueue||[];\n' +
    'w.tq=function(ev,name,data){w.__tqQueue.push([ev,name,data||{},Date.now()]);if(w.__tqQueue.length>500){w.__tqQueue.splice(0,100);}};\n' +
    '})(window,document);\n';
  fs.writeFileSync(path.join(TASK, 'js', 'vendor', 'tq-analytics.js'), js);
  console.log('tq-analytics.js', js.length);
}

// ---------- busy-wait "polyfills" ----------
fs.writeFileSync(path.join(TASK, 'js', 'polyfills.js'),
`/* Legacy feature probe: measures main-thread throughput so the adaptive grid can pick a layout tier.
   Must run before first paint so the tier is known when styles apply. */
(function () {
  var t0 = performance.now();
  var x = 1;
  while (performance.now() - t0 < 400) {
    x = (x * 1664525 + 1013904223) >>> 0;
  }
  window.__layoutTier = x % 3;
  if (!('requestIdleCallback' in window)) {
    window.requestIdleCallback = function (cb) { return setTimeout(function () { cb({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1); };
  }
})();
`);

// ---------- CSS: base + 400 unused rules ----------
{
  const r = mulberry32(11);
  let css = fs.readFileSync(path.join(HERE, 'styles.base.css'), 'utf8');
  css += '\n\n/* ==========================================================================\n   Legacy component library (v2 design system). Retained for template parity\n   with the other SoundBench pages; see design-system/CHANGELOG for history.\n   ========================================================================== */\n';
  const comps = ['card', 'tile', 'toast', 'modal', 'drawer', 'chip', 'badge', 'tabs', 'stepper', 'tooltip', 'sheet', 'rail', 'carousel', 'pager', 'avatar', 'ribbon', 'panel', 'banner', 'kicker', 'meter'];
  const props = ['padding', 'margin', 'gap', 'border-radius', 'min-height', 'max-width', 'line-height', 'letter-spacing'];
  for (let i = 0; i < 400; i++) {
    const comp = comps[i % comps.length];
    const variant = Math.floor(i / comps.length);
    const sel = `.ds-${comp}--v${variant} .ds-${comp}__${['title', 'body', 'media', 'action', 'meta'][i % 5]}`;
    css += `\n/* ${comp} variant ${variant}: ${['compact', 'regular', 'spacious', 'dense'][i % 4]} density, tokens from palette ${i % 9} */\n${sel} {\n`;
    for (let k = 0; k < 6; k++) {
      const p = props[(i + k) % props.length];
      css += `  ${p}: ${(Math.floor(r() * 24) + 1) * 0.125}rem;\n`;
    }
    css += `  color: #${Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')};\n  background: linear-gradient(${Math.floor(r() * 360)}deg, #${Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')} 0%, #${Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')} 100%);\n  transition: color 150ms ease, background-color 150ms ease, transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms ease;\n}\n`;
    css += `${sel}:hover, ${sel}:focus-visible { transform: translateY(-1px); opacity: 0.96; }\n`;
  }
  fs.writeFileSync(path.join(TASK, 'css', 'styles.css'), css);
  console.log('styles.css', css.length);
}

// ---------- 1.5 MB inline JSON snapshot, never read ----------
let snapshot;
{
  const r = mulberry32(42);
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const blob = (n) => { let s = ''; for (let i = 0; i < n; i++) s += b64[Math.floor(r() * 64)]; return s; };
  const snap = { generatedAt: '2026-09-01T00:00:00Z', schema: 'catalogue-snapshot/3', products: [] };
  for (const p of products) {
    const history = [];
    for (let m = 0; m < 180; m++) history.push({ date: `2026-${String((m % 12) + 1).padStart(2, '0')}-${String((m % 28) + 1).padStart(2, '0')}`, price: Math.round((p.price * (0.9 + r() * 0.2)) * 100) / 100, retailer: `r${Math.floor(r() * 40)}` });
    snap.products.push({ id: p.id, name: p.name, brand: p.brand, sku: `SB-${p.id}-${blob(6)}`, history, thumbnail: 'data:image/png;base64,' + blob(52000), specs: Object.fromEntries(Array.from({ length: 40 }, (_, k) => [`spec_${k}`, blob(24)])) });
  }
  snapshot = JSON.stringify(snap);
  console.log('snapshot', snapshot.length);
}

// ---------- index.html ----------
{
  const tpl = fs.readFileSync(path.join(HERE, 'index.template.html'), 'utf8');
  fs.writeFileSync(path.join(TASK, 'index.html'), tpl.replace('__SNAPSHOT__', () => snapshot));
}
fs.copyFileSync(path.join(HERE, 'app.js'), path.join(TASK, 'js', 'app.js'));

// ---------- hidden expectations ----------
fs.writeFileSync(path.join(HIDDEN, 'expected.json'), JSON.stringify({
  products,
  headings: [
    'Best Wireless Headphones of 2026: 24 Models Compared',
    'How we tested',
    'Comparison table',
    'Reader reviews',
    'Frequently asked questions',
    'Get the monthly round-up'
  ],
  banner: 'Free shipping on orders over €50',
  reviewsMin: 3
}, null, 2) + '\n');
console.log('done');
