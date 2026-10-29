// Generator for trial 10-visual fixtures: 6 before/after page pairs + shared CSS.
// Run: node generate.mjs  (writes shared/site.css, before/*.html, after/*.html, KEY.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const w = (p, s) => fs.writeFileSync(path.join(here, p), s);

const css = `/* NEXUS review-site design tokens (synthetic) */
:root{
  --accent:#0b4f9c; --accent-ink:#ffffff; --ink:#1b1f24; --muted:#5b6470; --bg:#ffffff; --panel:#f3f5f8;
  --line:#d9dee5; --warn:#b4530a; --radius:10px; --space:24px; --maxw:1120px;
  --font:Inter,"Segoe UI",Arial,sans-serif;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:var(--font);color:var(--ink);background:var(--bg);line-height:1.5;font-size:16px}
a{color:var(--accent)}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 var(--space)}
header.site{background:var(--accent);color:var(--accent-ink)}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
header.site .logo{font-weight:700;font-size:20px;letter-spacing:.02em}
header.site nav a{color:var(--accent-ink);text-decoration:none;margin-left:20px;font-size:15px}
.live-status{background:var(--panel);color:var(--muted);font-size:13px;height:36px;display:flex;align-items:center}
.live-status .wrap{display:flex;gap:24px;align-items:center;height:36px}
.hero{padding:56px 0 40px;background:linear-gradient(180deg,var(--panel),var(--bg))}
.hero h1{font-size:40px;line-height:1.15;margin:0 0 12px;max-width:720px}
.hero p{font-size:18px;color:var(--muted);max-width:640px;margin:0 0 24px}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);padding:12px 22px;border-radius:var(--radius);text-decoration:none;font-weight:600}
.btn.ghost{background:transparent;color:var(--accent);border:2px solid var(--accent);margin-left:12px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin:40px 0}
.card{border:1px solid var(--line);border-radius:var(--radius);padding:20px;position:relative;background:var(--bg)}
.card .thumb{height:140px;border-radius:6px;background:repeating-linear-gradient(135deg,var(--panel) 0 12px,var(--line) 12px 14px)}
.card h3{margin:16px 0 6px;font-size:20px}
.card .meta{color:var(--muted);font-size:14px;margin:0 0 10px}
.card .stars{color:var(--warn);letter-spacing:2px;font-size:14px}
.card .badge{position:absolute;top:12px;left:12px;background:var(--accent);color:var(--accent-ink);font-size:12px;font-weight:700;padding:4px 8px;border-radius:999px}
.card .price{font-weight:700;font-size:18px;margin-top:10px}
.pricing{margin-top:48px}
.pricing h2{font-size:28px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
th{background:var(--panel);font-weight:600}
td.num{text-align:right;font-variant-numeric:tabular-nums}
tr.best td{background:#eef4fb}
.note{color:var(--muted);font-size:13px;margin:12px 0 0}
footer.site{margin-top:56px;padding:28px 0;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
footer.site .cols{display:flex;gap:40px;flex-wrap:wrap}
footer.site a{color:var(--muted)}
@media (max-width:700px){
  .hero h1{font-size:30px}
  .cards{grid-template-columns:1fr}
  header.site nav a{margin-left:12px;font-size:14px}
  header.site nav a:nth-child(n+3){display:none}
  .btn.ghost{margin-left:0;margin-top:10px}
}
`;

function page({ title, extraHead = '', badge2 = true, liveStatus = false, subpixel = null }) {
  const cards = [
    ['Grain-Free Salmon Kibble', '12 kg bag · adult · salmon', '★★★★★', '£54.90', 'Best value'],
    ['Country Lamb & Rice', '10 kg bag · adult · lamb', '★★★★☆', '£46.50', 'Editor pick'],
    ['Puppy Chicken Starter', '6 kg bag · puppy · chicken', '★★★★☆', '£33.00', 'New'],
  ];
  const cardHtml = cards.map(([h, m, s, p, b], i) => `
      <article class="card" id="card-${i + 1}">
        <span class="badge">${b}</span>
        <div class="thumb"></div>
        <h3>${h}</h3>
        <p class="meta">${m}</p>
        <div class="stars">${s}</div>
        <div class="price">${p}</div>
      </article>`).join('');
  const live = liveStatus ? `
  <div class="live-status" data-dynamic><div class="wrap">
    <span>Prices checked: <span id="ts">—</span></span>
    <span><span id="online">—</span> visitors online</span>
  </div></div>
  <script>
    document.getElementById('ts').textContent = new Date().toLocaleString('en-GB');
    document.getElementById('online').textContent = String(10 + Math.floor(Math.random() * 90));
  </script>` : '';
  const sub = subpixel ? `<style>.hero p{transform:translateX(${subpixel})}</style>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="../shared/site.css">
${extraHead}${sub}
</head><body>
<header class="site"><div class="wrap"><div class="logo">PetFoodReview</div><nav><a href="#">Reviews</a><a href="#">Calculator</a><a href="#">Guides</a><a href="#">About</a></nav></div></header>${live}
<main class="wrap">
  <section class="hero">
    <h1>Best dry dog food in 2026: tested, weighed and compared</h1>
    <p>We fed 14 kibbles to a panel of 38 dogs for six weeks and tracked stool quality, coat shine and cost per 1,000 kcal.</p>
    <a class="btn" href="#">See the winners</a><a class="btn ghost" href="#">How we test</a>
  </section>
  <section class="cards">${cardHtml}
  </section>
  <section class="pricing">
    <h2>Price per 1,000 kcal</h2>
    <table>
      <thead><tr><th>Product</th><th>Bag</th><th class="num">kcal/100 g</th><th class="num">£ per 1,000 kcal</th></tr></thead>
      <tbody>
        <tr class="best"><td>Grain-Free Salmon Kibble</td><td>12 kg</td><td class="num">372</td><td class="num">1.23</td></tr>
        <tr><td>Country Lamb &amp; Rice</td><td>10 kg</td><td class="num">358</td><td class="num">1.30</td></tr>
        <tr><td>Puppy Chicken Starter</td><td>6 kg</td><td class="num">391</td><td class="num">1.41</td></tr>
        <tr><td>Budget Beef Mix</td><td>15 kg</td><td class="num">340</td><td class="num">0.88</td></tr>
      </tbody>
    </table>
    <p class="note">Prices are the lowest we found across four UK retailers on the test date. Kcal figures from manufacturer labels.</p>
  </section>
</main>
<footer class="site"><div class="wrap"><div class="cols">
  <div><strong>PetFoodReview</strong><br>Independent reviews since 2019</div>
  <div><a href="#">Privacy</a> · <a href="#">Affiliate disclosure</a> · <a href="#">Contact</a></div>
  <div>© 2026 Nexus Media Ltd</div>
</div></div></footer>
</body></html>
`;
}

w('shared/site.css', css);
const pairs = {
  U1: { before: {}, after: { extraHead: '<style>.pricing{margin-top:50px}</style>' } },
  U2: { before: {}, after: { extraHead: '<style>:root{--accent:#0b4fa0}</style>' } },
  U3: { before: {}, after: { extraHead: '<style>#card-2 .badge{display:none}</style>' } },
  U4: { before: {}, after: { extraHead: '<style>body{font-family:Arial,Helvetica,sans-serif}</style>' } },
  C1: { before: { liveStatus: true }, after: { liveStatus: true } },
  C2: { before: { subpixel: '0px' }, after: { subpixel: '0.4px' } },
};
for (const [id, p] of Object.entries(pairs)) {
  w(`before/${id}.html`, page({ title: `${id} before`, ...p.before }));
  w(`after/${id}.html`, page({ title: `${id} after`, ...p.after }));
}
console.log('wrote', Object.keys(pairs).join(','));
