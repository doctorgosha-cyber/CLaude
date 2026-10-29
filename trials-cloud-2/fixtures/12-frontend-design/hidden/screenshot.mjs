// Render a run dir to PNG at 390 and 1280 px (full page) for the blind judge.
// Usage: node screenshot.mjs <run-dir> <out-dir>   → <out-dir>/390.png, <out-dir>/1280.png
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { serveDir, launchBrowser, openPage, VIEWPORTS } from './harness.mjs';

export async function screenshotRun(runDir, outDir, { prefix = '' } = {}) {
  runDir = path.resolve(runDir); outDir = path.resolve(outDir);
  await mkdir(outDir, { recursive: true });
  const server = await serveDir(runDir);
  const browser = await launchBrowser();
  const files = {};
  try {
    for (const vp of Object.values(VIEWPORTS)) {
      const { page, context } = await openPage(browser, vp, server.url);
      await page.waitForTimeout(300);
      const file = path.join(outDir, `${prefix}${vp.width}.png`);
      await page.screenshot({ path: file, fullPage: true });
      files[vp.width] = file;
      await context.close();
    }
  } finally { await browser.close(); await server.close(); }
  return files;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const [runDir, outDir] = process.argv.slice(2);
  if (!runDir || !outDir) { console.error('usage: node screenshot.mjs <run-dir> <out-dir>'); process.exit(2); }
  console.log(JSON.stringify(await screenshotRun(runDir, outDir)));
}
