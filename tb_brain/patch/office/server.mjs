#!/usr/bin/env node
// OFFICE-2 Team Claude, Variant A ("Cats office"). One command: `node server.mjs`
// Serves public/ + the shared data API (../shared/http.mjs) on 127.0.0.1:4271.
// NEXUS root = auto-detected (4 levels up from this file), override with env NEXUS_ROOT. PORT env overrides the port.
// Offline: no outbound network; all assets are local (three.js is vendored in ../shared/vendor/three).
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from '../shared/http.mjs';
import { readLanFile, lanConfigFromFile, privateIPv4s } from '../shared/lan.mjs';
import { readMarketFlag } from '../shared/market.mjs';
import { signalsReader } from '../shared/signals.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.NEXUS_ROOT || path.join(HERE, '..', '..', '..', '..')); // variant-a -> claude -> OFFICE-2 -> work -> ROOT
const port = Number(process.env.PORT || 4271);
// LAN mode (phone on the home Wi-Fi + PIN): toggled by `node tools/lan.mjs on|off`, read at start.
// OFFICE_LAN_FILE overrides the file (developer checks on a test port use a temp file, never the Owner's).
const lanFile = path.resolve(process.env.OFFICE_LAN_FILE || path.join(HERE, '.local', 'lan.json'));
const lanAtStart = readLanFile(lanFile);
const lanOn = lanAtStart.enabled && !!lanAtStart.pin;
// Market live mode (A-TRADING): OFF by default. `node tools/market.mjs live on|off|status` writes .local/market.json
// ({live, intervalSec}, re-read on every request, no restart) or env OFFICE_MARKET_LIVE=1. When on, the SERVER makes
// key-less public GETs to data-api.binance.vision for the universe symbols (the office's only outbound call).
const marketFile = path.resolve(process.env.OFFICE_MARKET_FILE || path.join(HERE, '.local', 'market.json'));
const marketConfig = () => readMarketFlag(marketFile);

if (!fs.existsSync(path.join(root, 'agents')) && !fs.existsSync(path.join(root, '.claude'))) {
  console.warn(`[office-a] warning: ${root} does not look like the NEXUS root (no agents/ or .claude/). Set NEXUS_ROOT.`);
}

try {
  const s = await createServer({
    publicDir: path.join(HERE, 'public'), port, root, variant: 'a',
    ...(lanOn ? { host: '0.0.0.0', lan: { getConfig: lanConfigFromFile(lanFile) } } : {}),
    market: { getConfig: marketConfig, log: (m) => console.warn(m) },
    // TB-BRAIN: GET /api/signals = projects/trading-bot/out/signals.json (read-only; written by `node bot.mjs signals`).
    // The route itself lives in ../shared/http.mjs next to /api/market (see ../shared/signals.mjs for the handler).
    signals: signalsReader(root),
  });
  console.log(`NEXUS Office · Variant A (cats) → ${s.url}`);
  const mc = marketConfig();
  console.log(`  market: ${mc.live ? `LIVE (${mc.source}, every ${mc.intervalSec} s, public GET ${'data-api.binance.vision'})` : 'offline (local bars; `node tools/market.mjs live on` to enable)'}`);
  console.log(`  root: ${s.root}`);
  console.log(`  modes: ${s.url}  ·  ${s.url}?replay=1  ·  ${s.url}?demo=1 (MOCK)  ·  ?light=day|golden|night`);
  if (lanOn) {
    const urls = privateIPv4s().map((i) => `http://${i.address}:${s.port}/ (${i.name})`);
    console.log(`  LAN mode ON (home Wi-Fi, PIN): ${urls.join('  ·  ') || 'no private IPv4 adapter found'}`);
    console.log('  PIN: see `node tools/lan.mjs status`. Turn off: `node tools/lan.mjs off` + restart.');
  } else if (lanAtStart.enabled) {
    console.warn('[office-a] lan.json is enabled but has no valid PIN: LAN mode stays off. Run `node tools/lan.mjs on`.');
  }
  const stop = async () => { await s.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (e) {
  if (e && e.code === 'EADDRINUSE') console.error(`[office-a] port ${port} is busy. Stop the other server or run with PORT=<n>.`);
  else console.error('[office-a] failed to start:', e?.message ?? e);
  process.exit(1);
}
