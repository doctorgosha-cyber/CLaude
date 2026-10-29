// prints one line per warning from a stylelint JSON report
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const f of r) {
  const n = f.source.split('/').pop();
  for (const w of f.warnings) console.log(`${n}\t${w.line}:${w.column}\t${w.severity}\t${w.rule}\t${w.text.slice(0, 100)}`);
}
