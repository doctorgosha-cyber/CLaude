// Run gltf-validator (npm lib, validateBytes) over fixture files. Usage: node validate.mjs <mode:default|tuned> <out.json> <files...>
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools/gltf/');
const validator = require('gltf-validator');
const [mode, out, ...files] = process.argv.slice(2);
// default: library defaults (maxIssues 100, no overrides). tuned: unlimited issues, warnings count, degenerate triangles + unused objects promoted to errors.
const opts = mode === 'tuned'
  ? { maxIssues: 0, severityOverrides: { ACCESSOR_INDEX_TRIANGLE_DEGENERATE: 0, UNUSED_OBJECT: 0, ACCESSOR_NON_UNIT: 0, NODE_EMPTY: 0 } }
  : {};
const t0 = performance.now(); const results = [];
for (const f of files) {
  const t = performance.now(); let rep, error = null;
  try { rep = await validator.validateBytes(new Uint8Array(readFileSync(f)), { uri: basename(f), ...opts }); }
  catch (e) { error = String(e); }
  const msgs = rep?.issues?.messages ?? [];
  results.push({ file: f, ms: +(performance.now() - t).toFixed(1), error, version: rep?.validatorVersion,
    numErrors: rep?.issues?.numErrors, numWarnings: rep?.issues?.numWarnings, numInfos: rep?.issues?.numInfos, numHints: rep?.issues?.numHints,
    messages: msgs.map(m => ({ code: m.code, severity: m.severity, pointer: m.pointer, message: m.message })) });
}
const summary = { mode, validatorVersion: validator.version(), options: opts, total_ms: +(performance.now() - t0).toFixed(1), results };
writeFileSync(out, JSON.stringify(summary, null, 2));
for (const r of results) console.log(basename(r.file).padEnd(28), `err=${r.numErrors} warn=${r.numWarnings} info=${r.numInfos} hint=${r.numHints} ${r.ms}ms`, r.messages.map(m => `[${m.severity}]${m.code}@${m.pointer}`).join(' '));
console.log('total_ms', summary.total_ms);
