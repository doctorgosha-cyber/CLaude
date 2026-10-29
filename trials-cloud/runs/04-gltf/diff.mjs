// Pixel diff two PNGs with pixelmatch. Usage: node diff.mjs a.png b.png out-diff.png -> prints JSON {differing, total, pct}
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools/gltf/');
const { PNG } = require('pngjs'); const pixelmatch = (await import('/tmp/claude-0/-home-user-CLaude/6f421993-6727-5065-82a2-786c50db201d/scratchpad/tools/gltf/node_modules/pixelmatch/index.js')).default;
const [a, b, out] = process.argv.slice(2);
const A = PNG.sync.read(readFileSync(a)), B = PNG.sync.read(readFileSync(b));
if (A.width !== B.width || A.height !== B.height) throw new Error('size mismatch');
const D = new PNG({ width: A.width, height: A.height });
const differing = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
if (out) writeFileSync(out, PNG.sync.write(D));
const total = A.width * A.height; console.log(JSON.stringify({ a, b, differing, total, pct: +(100 * differing / total).toFixed(3) }));
