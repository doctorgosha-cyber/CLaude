// Structural check: parse an SVG with sax and verify the KEY.json requirements. Usage: node check-key.mjs KEY.json <dir> [label]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.SVGO_TOOLS + '/package.json');
const sax = require('sax');

export function parse(xml) {
  const root = { name: '#doc', attrs: {}, children: [], text: '' };
  const stack = [root];
  const p = sax.parser(true, { xmlns: false, position: false });
  p.onopentag = (n) => { const el = { name: n.name, attrs: n.attributes, children: [], text: '' }; stack[stack.length - 1].children.push(el); stack.push(el); };
  p.onclosetag = () => stack.pop();
  p.ontext = (t) => { stack[stack.length - 1].text += t; };
  p.oncdata = (t) => { stack[stack.length - 1].text += t; };
  p.onerror = (e) => { throw e; };
  p.write(xml).close();
  return root;
}
const walk = (el, fn, parents = []) => { fn(el, parents); for (const c of el.children) walk(c, fn, [...parents, el]); };

export function checkFile(xml, key) {
  const broken = [];
  let doc;
  try { doc = parse(xml); } catch (e) { return [`xml-parse-error: ${e.message.split('\n')[0]}`]; }
  const svg = doc.children.find((c) => c.name === 'svg');
  if (!svg) return ['no <svg> root'];
  const all = []; const ids = new Set(); const names = new Set(); const refs = new Set(); let styleText = '';
  walk(svg, (el, parents) => {
    all.push({ el, parents }); names.add(el.name);
    if (el.attrs.id) ids.add(el.attrs.id);
    if (el.name === 'style') styleText += el.text;
    for (const [k, v] of Object.entries(el.attrs)) {
      if ((k === 'href' || k === 'xlink:href') && v.startsWith('#')) refs.add(v.slice(1));
      for (const m of String(v).matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refs.add(m[1]);
      if (k === 'aria-labelledby') v.split(/\s+/).forEach((r) => refs.add(r));
    }
  });
  for (const m of styleText.matchAll(/url\(\s*['"]?#([^'")\s]+)/g)) refs.add(m[1]);
  if (key.viewBox && svg.attrs.viewBox !== key.viewBox) broken.push(`viewBox: expected "${key.viewBox}", got "${svg.attrs.viewBox}"`);
  for (const [k, v] of Object.entries(key.rootAttrs || {})) if (svg.attrs[k] !== v) broken.push(`root attr ${k}: expected "${v}", got "${svg.attrs[k]}"`);
  if (key.title !== undefined) { const t = svg.children.find((c) => c.name === 'title'); if (!t || t.text.trim() !== key.title) broken.push(`title: expected "${key.title}", got ${t ? JSON.stringify(t.text) : 'none'}`); }
  if (key.desc) { if (!svg.children.find((c) => c.name === 'desc')) broken.push('desc: missing'); }
  for (const id of key.ids || []) if (!ids.has(id)) broken.push(`id "${id}" missing`);
  for (const n of key.elements || []) if (!names.has(n)) broken.push(`element <${n}> missing`);
  if (key.refsResolve) for (const r of refs) if (!ids.has(r)) broken.push(`dangling reference #${r}`);
  for (const s of key.styleContains || []) if (!styleText.includes(s)) broken.push(`<style> lacks "${s}"`);
  const allText = all.map((a) => a.el.text).join(' ');
  for (const s of key.textContains || []) if (!allText.includes(s)) broken.push(`text "${s}" missing`);
  if (key.fontFamilyContains) {
    const ok = all.some(({ el, parents }) => (el.name === 'text' || el.name === 'tspan') && [el, ...parents].some((e) => (e.attrs['font-family'] || '').includes(key.fontFamilyContains) || (e.attrs.style || '').includes(key.fontFamilyContains)))
      || styleText.includes(key.fontFamilyContains);
    if (!ok) broken.push(`font-family "${key.fontFamilyContains}" missing`);
  }
  return broken;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [keyPath, dir, label = dir] = process.argv.slice(2);
  const KEY = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const out = {}; let total = 0;
  for (const f of Object.keys(KEY).filter((k) => !k.startsWith('_'))) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) { out[f] = { broken: ['output file missing'] }; total++; continue; }
    const xml = fs.readFileSync(p, 'utf8');
    const broken = checkFile(xml, KEY[f]);
    const leftover = (KEY[f].shouldRemove || []).filter((s) => xml.includes(s));
    out[f] = { broken, ...(KEY[f].shouldRemove ? { cruft_left: leftover } : {}) };
    total += broken.length;
  }
  console.log(JSON.stringify({ label, breakages: total, files: out }, null, 1));
  process.exitCode = total ? 1 : 0;
}
