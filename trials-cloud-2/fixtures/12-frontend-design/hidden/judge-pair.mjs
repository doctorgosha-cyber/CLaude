// Build one anonymised pair for the blind judge (see JUDGE.md).
// Usage: node judge-pair.mjs <run-A> <run-B> <pair-dir>
//   → <pair-dir>/judge/left-1280.png, right-1280.png, left-390.png, right-390.png   (give ONLY this folder to the judge)
//   → <pair-dir>/mapping.json                                                        (never shown to the judge)
import path from 'node:path';
import { randomInt } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { screenshotRun } from './screenshot.mjs';

const [a, b, pairDir] = process.argv.slice(2);
if (!a || !b || !pairDir) { console.error('usage: node judge-pair.mjs <run-A> <run-B> <pair-dir>'); process.exit(2); }
const judgeDir = path.join(path.resolve(pairDir), 'judge');
await mkdir(judgeDir, { recursive: true });
const left = randomInt(2) === 0 ? 'A' : 'B';
const map = { left: left === 'A' ? path.resolve(a) : path.resolve(b), right: left === 'A' ? path.resolve(b) : path.resolve(a), leftIs: left, rightIs: left === 'A' ? 'B' : 'A' };
for (const side of ['left', 'right']) {
  const files = await screenshotRun(map[side], judgeDir, { prefix: `${side}-` });
  for (const f of Object.values(files)) await rename(f, f); // keep names left-390.png / left-1280.png
}
await writeFile(path.join(path.resolve(pairDir), 'mapping.json'), JSON.stringify({ ...map, createdAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ judgeDir, mapping: path.join(path.resolve(pairDir), 'mapping.json') }));
