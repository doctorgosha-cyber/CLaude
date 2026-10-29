#!/usr/bin/env node
// checks/html.mjs — run html-validate (tuned config) on files/dirs, print JSON, exit 0 clean / 1 findings / 2 tool error.
// Usage: node checks/html.mjs <file-or-dir>... [--config path] [--ext html,htm]
// Requires: npm i html-validate@11.17.0 ; config: checks/htmlvalidate.tuned.json (+ elements-img-alt.json next to it)
import { FileSystemConfigLoader, HtmlValidate } from "html-validate";
import { readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv.splice(i, 2)[1] : def; };
const configPath = resolve(opt("--config", join(dirname(fileURLToPath(import.meta.url)), "htmlvalidate.tuned.json")));
const exts = new Set(opt("--ext", "html,htm").split(",").map((e) => "." + e.trim()));
const files = [];
const walk = (p) => statSync(p).isDirectory()
  ? readdirSync(p).filter((n) => n !== "node_modules").forEach((n) => walk(join(p, n)))
  : exts.has(extname(p).toLowerCase()) && files.push(p);
try {
  (argv.length ? argv : ["."]).forEach((p) => walk(resolve(p)));
  const hv = new HtmlValidate(new FileSystemConfigLoader({ extends: [configPath] }));
  const report = await hv.validateMultipleFiles(files);
  const findings = report.results.flatMap((r) => r.messages.map((m) => ({
    file: r.filePath, line: m.line, column: m.column, rule: m.ruleId, severity: m.severity === 2 ? "error" : "warning", message: m.message,
  })));
  console.log(JSON.stringify({ tool: "html-validate", config: configPath, files: files.length, errors: report.errorCount, warnings: report.warningCount, findings }, null, 2));
  process.exit(report.errorCount > 0 ? 1 : 0);
} catch (err) {
  console.log(JSON.stringify({ tool: "html-validate", error: String(err?.message ?? err) }));
  process.exit(2);
}
