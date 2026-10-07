// TB-BRAIN: read-only reader for GET /api/signals. Serves projects/trading-bot/out/signals.json (written by
// `node bot.mjs signals`), re-read on every request (no cache beyond mtime), never anything else from disk.
// No network, no state, no orders. Pair it with the route in http.mjs (see the patch note in TB-BRAIN REPORT.md):
//
//   if (url.pathname === '/api/signals' && req.method === 'GET') return sendJson(res, ...opts.signals.read());
//
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export function signalsReader(root, { file = path.join(root, 'projects', 'trading-bot', 'out', 'signals.json') } = {}) {
  let cache = null;
  return {
    file,
    /** -> [status, body]. 404 + {error} when the bot has not produced signals yet; 500 + {error} on a malformed file. */
    read() {
      let st;
      try { st = statSync(file); } catch { return [404, { error: 'signals.json не знайдено: запустіть `node bot.mjs signals` у projects/trading-bot', file }]; }
      if (cache && cache.mtimeMs === st.mtimeMs) return [200, cache.body];
      try {
        const body = JSON.parse(readFileSync(file, 'utf8'));
        if (!body || typeof body !== 'object' || !body.disclaimer) return [500, { error: 'signals.json без обов\'язкового поля disclaimer' }];
        cache = { mtimeMs: st.mtimeMs, body: { ...body, served_at: new Date().toISOString(), file_mtime: new Date(st.mtimeMs).toISOString() } };
        return [200, cache.body];
      } catch (e) { return [500, { error: `signals.json не читається: ${e.message}` }]; }
    },
  };
}
