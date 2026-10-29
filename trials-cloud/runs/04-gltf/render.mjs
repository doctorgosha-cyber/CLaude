// Baseline runtime gate: load each GLB with three.js GLTFLoader in headless Chromium (SwiftShader WebGL), render from a fixed camera,
// save a PNG and report whether loading/rendering threw. Usage: node render.mjs <outdir> <files...>
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { createRequire } from 'node:module';
const SCRATCH = '/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools';
const require = createRequire(SCRATCH + '/axe/');
const { chromium } = require('playwright-core');
const NM = SCRATCH + '/gltf/node_modules';
const [outdir, ...files] = process.argv.slice(2); mkdirSync(outdir, { recursive: true });
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html', '.wasm': 'application/wasm' };
const page_html = `<!doctype html><html><head><meta charset=utf-8>
<script type="importmap">{"imports":{"three":"/abs${NM}/three/build/three.module.js","three/addons/":"/abs${NM}/three/examples/jsm/"}}</script>
</head><body style="margin:0"><canvas id=c width=256 height=256></canvas><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
window.__errors = []; window.onerror = (m) => window.__errors.push(String(m)); window.onunhandledrejection = (e) => window.__errors.push(String(e.reason));
window.renderGlb = async (url) => {
  const res = { loaded: false, rendered: false, error: null, triangles: 0, bboxFinite: null, webgl: null };
  try {
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: false, preserveDrawingBuffer: true });
    res.webgl = renderer.getContext().getParameter(renderer.getContext().VERSION);
    renderer.setClearColor(0x202830, 1); renderer.setSize(256, 256, false);
    const scene = new THREE.Scene(); scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const d = new THREE.DirectionalLight(0xffffff, 2.5); d.position.set(3, 4, 5); scene.add(d);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 100); cam.position.set(1.6, 1.3, 2.0); cam.lookAt(0, 0, 0);
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(url); res.loaded = true;
    scene.add(gltf.scene);
    const box = new THREE.Box3().setFromObject(gltf.scene); res.bboxFinite = [box.min, box.max].every(v => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
    renderer.render(scene, cam); res.rendered = true; res.triangles = renderer.info.render.triangles;
    res.png = document.getElementById('c').toDataURL('image/png');
  } catch (e) { res.error = (e && e.stack) ? String(e.message || e) : String(e); }
  res.windowErrors = window.__errors.slice(); return res;
};
window.__ready = true;
</script></body></html>`;
const srv = createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page_html); }
  const p = u.startsWith('/abs/') ? u.slice(4) : null;
  if (!p || !existsSync(p)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': mime[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const t0 = performance.now(); const results = [];
for (const f of files) {
  const page = await browser.newPage(); const consoleErrs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => consoleErrs.push('pageerror: ' + e.message));
  const t = performance.now();
  await page.goto(`http://127.0.0.1:${port}/`); await page.waitForFunction(() => window.__ready);
  const r = await page.evaluate((u) => window.renderGlb(u), `/abs${f}`);
  const png = outdir + '/' + basename(f, '.glb') + '.png';
  if (r.png) { writeFileSync(png, Buffer.from(r.png.split(',')[1], 'base64')); delete r.png; r.pngPath = png; }
  results.push({ file: f, ms: +(performance.now() - t).toFixed(0), ...r, consoleErrs });
  await page.close();
}
await browser.close(); srv.close();
const summary = { total_ms: +(performance.now() - t0).toFixed(0), results };
writeFileSync(outdir + '/render.json', JSON.stringify(summary, null, 2));
for (const r of results) console.log(basename(r.file).padEnd(28), `loaded=${r.loaded} rendered=${r.rendered} tris=${r.triangles} bboxFinite=${r.bboxFinite} ${r.ms}ms`, r.error ? 'ERROR: ' + r.error : '', r.consoleErrs.length ? '| console: ' + r.consoleErrs.join(' || ') : '');
console.log('total_ms', summary.total_ms, 'webgl', results[0]?.webgl);
