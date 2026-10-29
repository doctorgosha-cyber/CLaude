// Visible smoke test: starts serve.mjs on a free port, checks that the page and every
// local asset it references are served, and that the catalogue has 24 products.
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const server = spawn(process.execPath, [path.join(ROOT, 'serve.mjs'), String(port)], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}/`;
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) failures++; };
try {
  let html = '';
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(base); html = await r.text(); if (r.ok) break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  check(html.includes('<h1'), 'index.html is served and has a heading');
  for (const id of ['hero-image', 'sort', 'filter', 'comparison-body', 'compare-count', 'compare-msg', 'newsletter', 'newsletter-email', 'newsletter-msg', 'reviews', 'faq']) {
    check(html.includes(`id="${id}"`), `markup keeps the hook id="${id}"`);
  }
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/g)) {
    const u = m[1];
    if (/^(https?:|data:|mailto:|\/\/)/.test(u)) continue;
    refs.add(u);
  }
  for (const m of html.matchAll(/srcset=["']([^"']+)["']/g)) for (const part of m[1].split(',')) refs.add(part.trim().split(/\s+/)[0]);
  for (const ref of refs) {
    const r = await fetch(new URL(ref, base));
    check(r.status === 200, `asset ${ref} -> ${r.status}`);
  }
  const catalogue = await (await fetch(base + 'data/products.json')).json().catch(() => null);
  check(Array.isArray(catalogue) && catalogue.length === 24 && catalogue.every(p => p.id && p.name), 'data/products.json lists 24 products with id and name');
} finally {
  server.kill();
}
console.log(failures ? `${failures} check(s) failed` : 'all smoke checks passed');
process.exit(failures ? 1 : 0);
