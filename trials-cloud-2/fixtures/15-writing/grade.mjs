#!/usr/bin/env node
// grade.mjs <run-dir> — grades the REWRITE arm: does ROLE-CARD.rewritten.md exist, how big is it,
// and did the six operational rules survive (regex presence checks, partial credit per rule).
// Prints ONE JSON line {"score":0..1,"passed":n,"total":6,"details":{...}}.
// score = mean of R1..R6 (each 0..1), capped at 0.5 when the rewrite is not compact
// (>= 90 % of the original's bytes) since the brief asked for compactness.
// The behavioural measurement (does an agent working from the card follow the rules) is
// hidden/grade-eval.mjs on the 6-task eval; this script only checks that the rules are still stated.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.log(JSON.stringify({ score: 0, passed: 0, total: 6, details: { error: 'usage: node grade.mjs <run-dir>' } })); process.exit(0); }
const rewritten = path.join(dir, 'ROLE-CARD.rewritten.md');
const originalPath = fs.existsSync(path.join(dir, 'ROLE-CARD.md')) ? path.join(dir, 'ROLE-CARD.md') : path.join(path.dirname(new URL(import.meta.url).pathname), 'task', 'ROLE-CARD.md');
const measure = (text) => ({ bytes: Buffer.byteLength(text, 'utf8'), words: (text.match(/\S+/g) || []).length, lines: text.split(/\r?\n/).length, tokens_est: Math.round([...text].length / 4) });

if (!fs.existsSync(rewritten)) {
  console.log(JSON.stringify({ score: 0, passed: 0, total: 6, details: { error: 'ROLE-CARD.rewritten.md missing' } }));
  process.exit(0);
}
const t = fs.readFileSync(rewritten, 'utf8');
const orig = fs.existsSync(originalPath) ? fs.readFileSync(originalPath, 'utf8') : null;
const near = (a, b, span = 120) => new RegExp(`${a}[^\\n]{0,${span}}${b}|${b}[^\\n]{0,${span}}${a}`, 'i').test(t);
const has = (re) => re.test(t);

const checks = {};
// R1: verdict word first
{
  const words = ['WORKING', 'PARTIAL', 'MOCK', 'PLANNED', 'BLOCKED'].filter(w => t.includes(w));
  const placement = near('(?:line\\s*1|first line|first|start|open|begin|top|precede)', '(?:verdict|WORKING)');
  checks.R1 = { score: 0.5 * (words.length / 5) + (placement ? 0.5 : 0), vocabulary: words.length, placement };
}
// R2: repo-relative paths
{
  const rel = has(/repo-?\s?relative|relative to (?:the )?(?:repo|repository|root)|from (?:the|that) (?:repo )?root|written from it/i);
  const abs = has(/absolute|\/home\/|~\//i);
  checks.R2 = { score: (rel ? 0.5 : 0) + (abs ? 0.5 : 0), relative_stated: rel, absolute_banned: abs };
}
// R3: escaped output
{
  const fns = has(/esc_html/) && has(/esc_attr/);
  const esc = has(/escap/i);
  const req = has(/\$_GET|request value|query param|\$_POST/i);
  checks.R3 = { score: (fns ? 0.5 : 0) + (esc ? 0.25 : 0) + (req ? 0.25 : 0), escapers_named: fns, escaping_stated: esc, request_values: req };
}
// R4: NEXT line, one action, last
{
  const nextWord = has(/\bNEXT\b/);
  const last = near('(?:last|final|end|close)', 'NEXT', 80);
  const one = has(/exactly one|one action|single action|one, not two|one next|\bone\b[^\n]{0,30}\baction/i);
  checks.R4 = { score: (nextWord ? 0.25 : 0) + (last ? 0.25 : 0) + (one ? 0.5 : 0), next_named: nextWord, last_line: last, single_action: one };
}
// R5: numbers carry units
{
  const unit = has(/\bunits?\b/i);
  const bound = near('(?:number|numeric|figure|quantit)', 'unit', 80);
  const table = near('(?:header|column)', 'unit', 120);
  checks.R5 = { score: (unit ? 0.5 : 0) + (bound ? 0.25 : 0) + (table ? 0.25 : 0), unit_stated: unit, numbers_bound: bound, table_header: table };
}
// R6: missing input => BLOCKED, no invented data
{
  const blocked = near('BLOCKED', '(?:missing|absent|not on disk|not found|does not exist|not present)', 160);
  const noInvent = has(/invent|fabricat|reconstruct|stub|approximat|make up|guess|sample/i);
  const name = has(/name[s]? the (?:missing )?(?:path|blocker|file|input)|naming the (?:missing )?(?:path|input)|name the missing/i);
  checks.R6 = { score: (blocked ? 0.5 : 0) + (noInvent ? 0.25 : 0) + (name ? 0.25 : 0), blocked_on_missing: blocked, no_invention: noInvent, names_path: name };
}
const scores = Object.values(checks).map(c => c.score);
let score = scores.reduce((a, b) => a + b, 0) / scores.length;
const size = measure(t);
const details = { checks, rewritten: size };
if (orig) {
  const os = measure(orig);
  details.original = os;
  details.ratio_bytes = Number((size.bytes / os.bytes).toFixed(3));
  details.identical = t.trim() === orig.trim();
  if (size.bytes >= 0.9 * os.bytes) { details.compactness_cap = 'rewrite is >= 90 % of original bytes; score capped at 0.5'; score = Math.min(score, 0.5); }
}
const passed = scores.filter(s => s >= 0.999).length;
console.log(JSON.stringify({ score: Number(score.toFixed(4)), passed, total: scores.length, details }));
