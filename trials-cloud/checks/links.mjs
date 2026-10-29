#!/usr/bin/env node
// checks/links.mjs — lychee link check. Offline (default) checks files and #fragments; --online also checks external links.
// Usage: node checks/links.mjs <file-or-dir>... [--online] [--lychee=/path/to/lychee]
// Exit 0 when all links resolve, 1 when some are broken, 2 when lychee failed. Prints JSON.
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const opt = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=').slice(1).join('=');
const bin = opt('lychee', process.env.LYCHEE ?? (process.platform === 'win32' ? 'lychee.exe' : 'lychee'));
const inputs = args.filter(a => !a.startsWith('--'));
const online = args.includes('--online');
const flags = ['--no-progress', '--format', 'json', '--include-fragments', ...(online ? ['--max-retries', '1', '--timeout', '15', '--accept', '200..=399,403,429', '--user-agent', 'Mozilla/5.0 (compatible; nexus-linkcheck/1.0)'] : ['--offline'])];
const r = spawnSync(bin, [...flags, ...inputs], { encoding: 'utf8', maxBuffer: 1 << 26 });
let j; try { j = JSON.parse(r.stdout); } catch { console.log(JSON.stringify({ ok: false, error: r.stderr.slice(-1500) })); process.exit(2); }
const broken = [];
for (const [source, list] of Object.entries(j.error_map ?? {})) for (const e of list) broken.push({ source, url: e.url, status: typeof e.status === 'object' ? (e.status.text ?? JSON.stringify(e.status)) : String(e.status) });
console.log(JSON.stringify({ ok: broken.length === 0, mode: online ? 'online' : 'offline', total: j.total, successful: j.successful, excluded: j.excludes, broken }, null, 2));
process.exit(broken.length ? 1 : 0);
