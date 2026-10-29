// Merge runs/*/result.json into results-2.json
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
const trials = [];
for (const d of readdirSync('runs').sort()) { const p = `runs/${d}/result.json`; if (existsSync(p)) trials.push(JSON.parse(readFileSync(p, 'utf8'))); }
trials.sort((a, b) => a.id - b.id);
writeFileSync('results-2.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), brief: 'HANDOFF 2: 16 tool and skill trials', sandbox: 'claude.ai cloud container, Linux x86_64, 4 vCPU, Node 22.22.0, Python 3.13.16, PHP 8.3.6; network limited to package registries, raw.githubusercontent.com and the OSV offline-database bucket; up to 15 trials ran concurrently, so runtimes carry shared-CPU noise', trials }, null, 2));
console.log(trials.map(t => `${t.id} ${t.verdict}`).join('\n'));
