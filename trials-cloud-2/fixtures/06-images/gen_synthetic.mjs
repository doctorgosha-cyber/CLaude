// Generates 3 "text-on-image banners" (photo + crisp SVG text via sharp composite)
// and 1 flat-colour product-like rendering (SVG rasterised). Run: node gen_synthetic.mjs <srcdir>
import sharp from 'sharp';
import path from 'node:path';
const out = process.argv[2];
const svgText = (w, h, title, sub, colour) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<rect x="0" y="${h*0.62}" width="${w}" height="${h*0.38}" fill="${colour}" fill-opacity="0.72"/>
<text x="${w*0.05}" y="${h*0.76}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${Math.round(h*0.075)}" fill="#ffffff">${title}</text>
<text x="${w*0.05}" y="${h*0.86}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${Math.round(h*0.04)}" fill="#ffe08a">${sub}</text>
<text x="${w*0.05}" y="${h*0.94}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${Math.round(h*0.028)}" fill="#ffffff">Best dry food for senior cats 2026 - tested by NEXUS - score 9.2/10</text>
</svg>`);
const banners = [
  ['photo_chelsea', 'banner_text_chelsea', 'TOP 10 CAT FOODS', 'Grain-free picks reviewed', '#1b2a49'],
  ['photo_coffee', 'banner_text_coffee', 'COFFEE GEAR GUIDE', 'Espresso machines under 500', '#4a1b1b'],
  ['photo_astronaut', 'banner_text_astronaut', 'SPACE TECH REVIEW', 'Telescopes for beginners', '#102a10'],
];
for (const [src, name, t, s, c] of banners) {
  const img = sharp(path.join(out, src + '.png'));
  const { width, height } = await img.metadata();
  await img.composite([{ input: svgText(width, height, t, s, c) }]).png().toFile(path.join(out, name + '.png'));
  console.log(name, width, height);
}
// flat product-like render: packaging box with sharp edges, flat colours, small label text
const W = 800, H = 600;
const flat = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#f4f1ea"/>
<polygon points="250,120 520,90 520,420 250,450" fill="#e8562a"/>
<polygon points="520,90 620,150 620,470 520,420" fill="#b23e1a"/>
<polygon points="250,120 350,180 620,150 520,90" fill="#ff7a4d"/>
<rect x="280" y="190" width="200" height="60" fill="#ffffff"/>
<text x="300" y="232" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="30" fill="#1b2a49">PETFOOD</text>
<text x="280" y="300" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#ffffff">Adult cat - chicken 2 kg</text>
<circle cx="440" cy="360" r="40" fill="#ffd500"/><text x="418" y="368" font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="20" fill="#1b2a49">NEW</text>
<rect x="60" y="500" width="680" height="4" fill="#1b2a49"/>
<text x="60" y="540" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#1b2a49">Ingredients: chicken 45%, rice, peas, salmon oil, taurine, vitamins A/D3/E</text>
</svg>`;
await sharp(Buffer.from(flat), { density: 96 }).png().toFile(path.join(out, 'flat_product_box.png'));
console.log('flat_product_box', W, H);
