import { chromium } from "playwright-core";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const axeSrc = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const dirs = process.argv.slice(2);
const files = dirs.flatMap(d => readdirSync(d).filter(f => f.endsWith(".html")).map(f => join(d, f)));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage();
const out = {};
for (const f of files) {
  await page.goto("file://" + f);
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target.join(" ")) })); });
  out[f.split("/").slice(-2).join("/")] = r;
  for (const v of r) console.log(f.split("/").pop(), v.id, v.impact, v.nodes.join(" | "));
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
