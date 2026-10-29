// Baseline: home-made offline Markdown link check — relative links must point to an existing file (fragments and http(s) ignored).
import { readFileSync, existsSync } from 'node:fs'; import { resolve, dirname } from 'node:path';
const file = process.argv[2]; const md = readFileSync(file, 'utf8'); const bad = []; let n = 0;
for (const m of md.matchAll(/\]\(([^)\s]+)\)/g)) { n++; const l = m[1]; if (/^https?:/.test(l) || l.startsWith('#')) continue; const p = resolve(dirname(file), l.split('#')[0]); if (!existsSync(p)) bad.push(l); }
console.log(JSON.stringify({ file, links: n, broken: bad }));
