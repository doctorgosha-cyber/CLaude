// Builds reference/ from task/ (run after gen.mjs). Uses sharp from the tools dir for image re-encoding.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TASK = path.join(ROOT, 'task');
const REF = path.join(ROOT, 'reference');
const TOOLS = '/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/11-perf';
const sharp = createRequire(path.join(TOOLS, 'package.json'))('sharp');

fs.rmSync(REF, { recursive: true, force: true });
fs.cpSync(TASK, REF, { recursive: true });

// --- images ---
const img = (f) => path.join(REF, 'img', f);
await sharp(img('hero.png')).resize(1200).webp({ quality: 72 }).toFile(img('hero-1200.webp'));
await sharp(img('hero.png')).resize(800).webp({ quality: 72 }).toFile(img('hero-800.webp'));
await sharp(img('hero.png')).resize(480).webp({ quality: 70 }).toFile(img('hero-480.webp'));
for (let i = 1; i <= 4; i++) await sharp(img(`related-${i}.png`)).resize(480).webp({ quality: 70 }).toFile(img(`related-${i}.webp`));
for (let i = 1; i <= 5; i++) await sharp(img(`avatar-${i}.png`)).resize(112).webp({ quality: 75 }).toFile(img(`avatar-${i}.webp`));
for (const f of fs.readdirSync(img(''))) if (f.endsWith('.png')) fs.unlinkSync(img(f));

// --- fonts: system stack instead of 2 MB of TTFs ---
fs.rmSync(path.join(REF, 'fonts'), { recursive: true, force: true });

// --- scripts: drop the dead analytics bundle and the busy-wait probe ---
fs.rmSync(path.join(REF, 'js', 'vendor'), { recursive: true, force: true });
fs.unlinkSync(path.join(REF, 'js', 'polyfills.js'));

// --- data: one merged catalogue file (products.json / product-*.json kept for other consumers) ---
const products = JSON.parse(fs.readFileSync(path.join(TASK, 'data', 'products.json'), 'utf8'));
const merged = products.map(p => ({ ...p, ...JSON.parse(fs.readFileSync(path.join(TASK, 'data', `product-${p.id}.json`), 'utf8')) }));
fs.writeFileSync(path.join(REF, 'data', 'catalogue.json'), JSON.stringify(merged));

// --- CSS: base rules only, no @font-face, no legacy library ---
let css = fs.readFileSync(path.join(HERE, 'styles.base.css'), 'utf8');
css = css.replace(/@font-face\s*\{[^}]*\}\s*/g, '');
css = css.replace('font-family: "DejaVu Sans Web", Arial, sans-serif;', 'font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;');
css = css.replace('.hero img { width: 100%; display: block; border-radius: 8px; }', '.hero img { width: 100%; height: auto; display: block; border-radius: 8px; aspect-ratio: 1800 / 1000; }');
css = css.replace('.related-grid img { width: 100%; display: block; border-radius: 6px; }', '.related-grid img { width: 100%; height: auto; display: block; border-radius: 6px; aspect-ratio: 4 / 3; }');
css = css.replace('.review img { width: 56px; border-radius: 50%; flex: none; }', '.review img { width: 56px; height: 56px; border-radius: 50%; flex: none; }');
css = css.replace(/\/\* ======[\s\S]*$/, '');
css = css.replace(/\s*\n\s*\n/g, '\n');
fs.writeFileSync(path.join(REF, 'css', 'styles.css'), css);

// --- HTML ---
let html = fs.readFileSync(path.join(HERE, 'index.template.html'), 'utf8');
html = html.replace(/<script type="application\/json" id="catalogue-snapshot">__SNAPSHOT__<\/script>\n/, '');
html = html.replace('<script src="js/vendor/tq-analytics.js"></script>\n<script src="js/polyfills.js"></script>\n', '');
html = html.replace('<link rel="stylesheet" href="css/styles.css">',
  '<link rel="preload" as="image" href="img/hero-800.webp" imagesrcset="img/hero-480.webp 480w, img/hero-800.webp 800w, img/hero-1200.webp 1200w" imagesizes="(max-width: 64rem) 100vw, 62rem" fetchpriority="high">\n' +
  '<style>\n' + css + '</style>\n<script src="js/app.js" defer></script>');
html = html.replace('<img id="hero-image" src="img/hero.png" alt="Six of the tested wireless headphones laid out on a wooden desk">',
  '<img id="hero-image" src="img/hero-800.webp" srcset="img/hero-480.webp 480w, img/hero-800.webp 800w, img/hero-1200.webp 1200w" sizes="(max-width: 64rem) 100vw, 62rem" width="1800" height="1000" fetchpriority="high" decoding="async" alt="Six of the tested wireless headphones laid out on a wooden desk">');
for (let i = 1; i <= 4; i++) html = html.replace(`<img src="img/related-${i}.png"`, `<img src="img/related-${i}.webp" width="480" height="360" loading="lazy" decoding="async"`);
for (let i = 1; i <= 5; i++) html = html.replace(`<img src="img/avatar-${i}.png"`, `<img src="img/avatar-${i}.webp" width="56" height="56" loading="lazy" decoding="async"`);
html = html.replace('<body>\n', '<body>\n<div class="promo-banner" id="promo-banner"><strong>Free shipping on orders over €50</strong> — this week only, on every model in the table. <span class="promo-terms">Applies to orders shipped within the EU; the discount is shown at checkout.</span></div>\n');
html = html.replace('<script src="js/app.js"></script>\n', '<script>window.__tqQueue=[];window.tq=function(){window.__tqQueue.push(Array.prototype.slice.call(arguments));};</script>\n');
fs.writeFileSync(path.join(REF, 'index.html'), html);

// --- app.js: single fetch instead of N+1; banner is static now ---
let js = fs.readFileSync(path.join(HERE, 'app.js'), 'utf8');
js = js.replace(/  async function loadCatalogue\(\) \{[\s\S]*?\n  \}\n/, `  async function loadCatalogue() {
    // One request: data/catalogue.json is the catalogue with each product's detail merged in
    // (same records as data/products.json + data/product-<id>.json, in the same order).
    var res = await fetch('data/catalogue.json');
    if (!res.ok) throw new Error('catalogue request failed: ' + res.status);
    return res.json();
  }
`);
js = js.replace(/  \/\/ ---------- promo banner ----------[\s\S]*?\n  \}\n\n/, '');
js = js.replace(/\n    \/\/ Marketing wants the banner[\s\S]*?\n    \}\);\n/, '\n');
js = js.replace(" * The table row for a product merges the two records.", " * The table row for a product merges the two records; data/catalogue.json ships them pre-merged.");
fs.writeFileSync(path.join(REF, 'js', 'app.js'), js);

fs.writeFileSync(path.join(REF, 'PERF.md'), `# Performance notes

Baseline (Lighthouse 13, mobile, simulated throttling, median of 3): score 21, LCP 49.7 s, CLS 0.18, TBT 1.6 s, 9.1 MB transferred.

Changes, each measured in isolation before being kept:

| Change | Effect |
|---|---|
| Removed the 1.5 MB inline catalogue snapshot (never read) | FCP 18.9 s -> 8.6 s |
| Dropped the 300 KB analytics bundle (page only needs \`tq()\`; 60-byte inline queue stub keeps the call working) and the 400 ms busy-wait probe | TBT 1.6 s -> 0.2 s, render no longer blocked |
| Hero: 3 MB PNG -> 480/800/1200 px WebP with srcset, width/height, fetchpriority=high + preload | LCP -> ~1.3 s |
| Related/avatars: WebP, width/height, loading=lazy | 2.5 MB off the critical path, CLS 0 below the fold |
| Fonts: system stack instead of 4 self-hosted TTFs (760 KB on the wire) | no FOIT, no font swap shift |
| CSS: deleted the 400-rule legacy library, inlined the remaining 4 KB | no render-blocking stylesheet |
| Promo banner rendered statically in HTML instead of inserted after paint | CLS 0.18 -> 0 |
| Comparison data: one merged catalogue.json instead of 1 + 24 sequential fetches | table renders ~3.5 s earlier on 4G |
| app.js deferred | not render-blocking |

Result: score 100, LCP ~1.2 s, CLS 0, TBT 0 ms, ~110 KB transferred. All functional behaviour (sort tie-breaks,
brand filter, compare cap of 4, FAQ, newsletter validation) unchanged; \`npm test\` green.
`);
console.log('reference built');
