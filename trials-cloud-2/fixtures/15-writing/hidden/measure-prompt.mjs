#!/usr/bin/env node
// measure-prompt.mjs <file> [...files] — approximate size of a prompt file.
// Tokens are ESTIMATED as chars/4 (the usual English-prose heuristic); no tokenizer package is used,
// so compare estimates only against each other, never against a provider's bill.
import fs from 'node:fs';
const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node measure-prompt.mjs <file> [...]'); process.exit(2); }
const out = files.map(f => {
  const text = fs.readFileSync(f, 'utf8');
  const chars = [...text].length;
  return {
    file: f,
    bytes: Buffer.byteLength(text, 'utf8'),
    chars,
    words: (text.match(/\S+/g) || []).length,
    lines: text.split(/\r?\n/).length,
    tokens_est: Math.round(chars / 4),
    method: 'chars/4',
  };
});
console.log(JSON.stringify(out.length === 1 ? out[0] : out));
