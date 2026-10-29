// Usage: node runner.mjs <absolute path to src/pricing.mjs>
// Prints one JSON line: { results: [{ id, name, ok, error }], loadError }
import { pathToFileURL } from 'node:url';
import { cases } from './cases.mjs';

const modPath = process.argv[2];
let mod = null, loadError = null;
try {
  mod = await import(pathToFileURL(modPath).href);
} catch (e) {
  loadError = String(e && e.stack || e).split('\n').slice(0, 3).join(' | ');
}
const results = [];
for (const c of cases) {
  if (!mod) { results.push({ id: c.id, name: c.name, ok: false, error: 'module failed to load' }); continue; }
  try {
    c.run(mod);
    results.push({ id: c.id, name: c.name, ok: true });
  } catch (e) {
    results.push({ id: c.id, name: c.name, ok: false, error: String(e && e.message || e).slice(0, 300) });
  }
}
process.stdout.write(JSON.stringify({ results, loadError }) + '\n');
