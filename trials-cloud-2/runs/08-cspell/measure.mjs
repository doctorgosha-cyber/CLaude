// Scores a cspell text output (file:line:col - Unknown word (w)) against fixtures/08-cspell/KEY.json.
// usage: node measure.mjs <cspell-output.txt> <KEY.json>
import { readFileSync } from 'node:fs';
const [out, keyPath] = process.argv.slice(2);
const key = JSON.parse(readFileSync(keyPath, 'utf8'));
const flags = [];
for (const l of readFileSync(out, 'utf8').split('\n')) {
  const m = l.match(/^(.+?):(\d+):(\d+) - Unknown word \((.+?)\)/);
  if (m) flags.push({ file: m[1], line: +m[2], word: m[4] });
}
const BRAND = /^(Thermoflask|Kailh|Cherry|Anatomy)$/;
const SKU = /^[A-Z]{3,5}$/;
const classify = (w) => BRAND.test(w) ? 'brand/proper noun' : SKU.test(w) ? 'SKU/code token' : 'real dictionary gap';
const found = {}; const used = new Set();
for (const s of key.seeded) {
  const typoWords = s.typo.split(' ');
  const hits = flags.filter(f => f.file === s.file && f.line === s.line && typoWords.includes(f.word));
  found[s.id] = hits.length > 0;
  hits.forEach(h => used.add(h));
}
const other = flags.filter(f => !used.has(f));
const onControls = other.filter(f => key.controls.includes(f.file));
const onSeeded = other.filter(f => !key.controls.includes(f.file));
const tally = (arr) => arr.reduce((a, f) => { const c = classify(f.word); a[c] = (a[c] || 0) + 1; return a; }, {});
const words = (arr) => [...new Set(arr.map(f => `${f.word}(${classify(f.word)})`))];
console.log(JSON.stringify({
  total_flags: flags.length,
  found, recall: `${Object.values(found).filter(Boolean).length}/${key.seeded.length}`,
  false_positives_on_controls: onControls.length, control_breakdown: tally(onControls), control_words: words(onControls),
  extra_findings_on_seeded: onSeeded.length, seeded_breakdown: tally(onSeeded), seeded_extra_words: words(onSeeded),
}, null, 2));
