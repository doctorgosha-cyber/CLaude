import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
const r = await page.evaluate(() => {
  const ctx = document.getElementById('c').getContext('2d'); const out = {};
  for (const f of ['Inter', 'Arial', '"Segoe UI"', 'sans-serif', 'Carlito', '"DejaVu Sans"', '"Liberation Sans"', 'Inter,"Segoe UI",Arial,sans-serif', '"Segoe UI",Arial,sans-serif', 'serif', '"Bitstream Charter"']) {
    ctx.font = `16px ${f}`; out[f] = { w: ctx.measureText('Best dry dog food in 2026: tested, weighed and compared').width, check: document.fonts.check(`16px ${f}`) };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
