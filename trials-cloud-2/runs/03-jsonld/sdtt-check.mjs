// Candidate (b): structured-data-testing-tool 4.5.0 via its Node API, offline, on a local file buffer.
// Usage: node sdtt-check.mjs [--presets Google] file.html ...
import { readFileSync } from 'node:fs'; import { createRequire } from 'node:module';
const SDTT = process.env.SDTT_DIR || '/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools2/03-jsonld/sdtt/node_modules/structured-data-testing-tool';
const req = createRequire(SDTT + '/package.json');
const { structuredDataTest } = req(SDTT); const { Google } = req(SDTT + '/presets');
const args = process.argv.slice(2); const usePreset = args.includes('--google'); const files = args.filter(a => !a.startsWith('--'));
const out = {}; let total = 0; const t0 = performance.now();
for (const f of files) {
  const buf = readFileSync(f); let r;
  try { r = await structuredDataTest(buf, usePreset ? { presets: [Google] } : {}); }
  catch (e) { r = e.res || e; if (!r.failed) { out[f.split('/').pop()] = { error: String(e.message || e) }; continue; } }
  const failed = (r.failed || []).map(t => ({ test: t.test, group: t.group, error: t.error && t.error.message }));
  const warnings = (r.warnings || []).map(t => ({ test: t.test, group: t.group }));
  out[f.split('/').pop()] = { passed: (r.passed || []).length, failed, warnings, schemas: r.schemas };
  total += failed.length;
}
console.log(JSON.stringify({ runtime_ms: Math.round(performance.now() - t0), files: out }, null, 2));
process.exit(total ? 1 : 0);
