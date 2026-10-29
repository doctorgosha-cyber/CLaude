// Runs Lighthouse (performance only, mobile, simulated throttling) N times and returns the median run.
export async function runLighthouse({ lighthouse, chromeLauncher, chromePath, url, runs = 3 }) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const all = [];
  try {
    for (let i = 0; i < runs; i++) {
      const r = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'silent', onlyCategories: ['performance'] });
      const lhr = r.lhr;
      const a = lhr.audits;
      all.push({
        score: Math.round((lhr.categories.performance.score ?? 0) * 100),
        lcp_ms: Math.round(a['largest-contentful-paint']?.numericValue ?? -1),
        cls: Math.round((a['cumulative-layout-shift']?.numericValue ?? -1) * 1000) / 1000,
        tbt_ms: Math.round(a['total-blocking-time']?.numericValue ?? -1),
        fcp_ms: Math.round(a['first-contentful-paint']?.numericValue ?? -1),
        speed_index_ms: Math.round(a['speed-index']?.numericValue ?? -1),
        transferred_bytes: Math.round(a['total-byte-weight']?.numericValue ?? -1),
        runtime_error: lhr.runtimeError?.message || null,
      });
    }
  } finally {
    await chrome.kill();
  }
  const sorted = all.slice().sort((x, y) => x.score - y.score);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { median, all };
}
