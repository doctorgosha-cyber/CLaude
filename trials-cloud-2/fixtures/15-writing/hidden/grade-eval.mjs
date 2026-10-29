#!/usr/bin/env node
// grade-eval.mjs — grades an agent's work on the 6 hidden eval tasks (t1..t6).
//
// Usage:
//   node grade-eval.mjs <eval-run-dir>            # <eval-run-dir>/t1 .. t6, each a worked copy of hidden/eval/tN
//   node grade-eval.mjs <task-run-dir> --task t3  # a single worked task folder
//
// Prints ONE JSON line: {"score":0..1,"passed":n,"total":m,"details":{...}}
// score = mean over graded tasks of (mean over that task's checks). Each check is 0..1.
// Rules: R1 verdict line first, R2 repo-relative paths, R3 escaped PHP output,
//        R4 single NEXT line last, R5 numbers carry units, R6 missing input => BLOCKED.
// Leaves nothing behind except <dir>/__grade__/ which it deletes.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const VERDICTS = ['WORKING', 'PARTIAL', 'MOCK', 'PLANNED', 'BLOCKED'];
const UNITS = [
  's', 'sec', 'secs', 'second', 'seconds', 'ms', 'min', 'mins', 'minute', 'minutes', 'h', 'hr', 'hrs', 'hour', 'hours', 'day', 'days', 'week', 'weeks',
  'b', 'byte', 'bytes', 'kb', 'kib', 'mb', 'mib', 'gb', 'kilobyte', 'kilobytes', 'megabyte', 'megabytes',
  '%', 'percent', 'pct', 'kcal', 'kj', 'cal', 'g', 'kg', 'mg', 'lb', 'lbs', 'oz', 'ml', 'l', 'mm', 'cm', 'm', 'km', 'px', 'em', 'rem', 'pt',
  'eur', 'usd', 'gbp', 'cent', 'cents', 'x', '×',
  'line', 'lines', 'file', 'files', 'row', 'rows', 'item', 'items', 'entry', 'entries', 'column', 'columns', 'cell', 'cells', 'key', 'keys', 'field', 'fields',
  'product', 'products', 'breed', 'breeds', 'record', 'records', 'test', 'tests', 'check', 'checks', 'call', 'calls', 'char', 'chars', 'character', 'characters',
  'word', 'words', 'token', 'tokens', 'helper', 'helpers', 'function', 'functions', 'page', 'pages', 'post', 'posts', 'param', 'params', 'parameter', 'parameters',
  'error', 'errors', 'warning', 'warnings', 'issue', 'issues', 'edit', 'edits', 'occurrence', 'occurrences', 'match', 'matches', 'time', 'times', 'place', 'places',
  'site', 'sites', 'template', 'templates', 'partial', 'partials', 'figure', 'figures', 'decimal', 'decimals', 'review', 'reviews', 'deliverable', 'deliverables',
  'change', 'changes', 'rename', 'renames', 'replacement', 'replacements', 'reference', 'references', 'definition', 'definitions', 'use', 'uses', 'usage', 'usages',
  'input', 'inputs', 'output', 'outputs', 'block', 'blocks', 'table', 'tables', 'value', 'values', 'number', 'numbers', 'result', 'results', 'step', 'steps',
  'run', 'runs', 'pass', 'passes', 'failure', 'failures', 'pack', 'packs', 'spot', 'spots', 'location', 'locations', 'attribute', 'attributes', 'element', 'elements',
  'sf', 'dp', 'places', 'tool-call', 'tool-calls', 'tool', 'tools', 'commit', 'commits', 'diff', 'diffs', 'budget', 'budgets', 'assertion', 'assertions', 'case', 'cases',
];
const UNIT_RE = new RegExp('^\\s?(?:' + UNITS.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z])', 'i');
const UNIT_RE_ADJ = new RegExp('^\\s(?:[A-Za-z-]+)\\s(?:' + UNITS.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z])', 'i');
const ESCAPERS = /esc_html|esc_attr|esc_url|esc_js|esc_textarea|esc_html_e|esc_attr_e|esc_html__|esc_attr__|wp_kses|wp_kses_post|json_encode|wp_json_encode|absint\(|intval\(|\(int\)|\(float\)/;

// ---------- helpers ----------
const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('--'));
const taskArgIdx = args.indexOf('--task');
const onlyTask = taskArgIdx >= 0 ? args[taskArgIdx + 1] : null;
if (!dir || !fs.existsSync(dir)) {
  console.log(JSON.stringify({ score: 0, passed: 0, total: 0, details: { error: 'usage: node grade-eval.mjs <eval-run-dir> [--task tN]' } }));
  process.exit(0);
}
const ROOT = path.resolve(dir);
const SCRATCH = path.join(ROOT, '__grade__');
const PHP = (() => { const r = spawnSync('php', ['--version']); return r.status === 0; })();

function readIf(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function findReport(taskDir) {
  for (const n of ['REPORT.md', 'report.md', 'Report.md', 'REPORT.MD']) {
    const p = path.join(taskDir, n);
    if (fs.existsSync(p)) return readIf(p);
  }
  return null;
}
function stripDecor(line) {
  return line.replace(/^[\s#*_>`\-]+/, '').replace(/[\s*_`]+$/, '').trim();
}
function nonEmptyLines(text) { return text.split(/\r?\n/).filter(l => l.trim() !== ''); }
function clamp(x) { return Math.max(0, Math.min(1, x)); }
function phpLint(file) {
  if (!PHP) return null;
  const r = spawnSync('php', ['-l', file]);
  return r.status === 0;
}
function phpRun(code, cwd, env = {}) {
  if (!PHP) return null;
  fs.mkdirSync(SCRATCH, { recursive: true });
  const f = path.join(SCRATCH, 'h_' + Math.random().toString(36).slice(2) + '.php');
  fs.writeFileSync(f, code);
  const r = spawnSync('php', ['-d', 'display_errors=stderr', f], { cwd, env: { ...process.env, ...env }, timeout: 15000 });
  return { status: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') };
}

// ---------- rule checks ----------
function verdictOf(report) {
  const lines = nonEmptyLines(report);
  if (!lines.length) return null;
  let first = stripDecor(lines[0]).replace(/^verdict\s*[:—–-]\s*/i, '');
  const m = first.match(/^(WORKING|PARTIAL|MOCK|PLANNED|BLOCKED)\b/);
  return m ? m[1] : null;
}
function checkR1(report) { // first line is a verdict word
  const v = verdictOf(report);
  if (v) return { score: 1, verdict: v };
  const lines = nonEmptyLines(report);
  const first = lines[0] ? stripDecor(lines[0]) : '';
  const anywhere = first.match(/\b(WORKING|PARTIAL|MOCK|PLANNED|BLOCKED)\b/);
  return { score: anywhere ? 0.5 : 0, verdict: null, first_line: first.slice(0, 80) };
}
function checkR2(report, taskRoot) { // paths repo-relative
  const abs = [];
  const re = /(?:^|[\s`'"(\[])((?:\/(?:home|tmp|usr|var|opt|root|Users|mnt|workspace|srv|private|run|work)\/[^\s`'")\]]+)|(?:[A-Za-z]:\\[^\s`'")\]]+)|(?:~\/[^\s`'")\]]+))/g;
  let m;
  while ((m = re.exec(report))) abs.push(m[1]);
  if (report.includes(taskRoot)) abs.push(taskRoot);
  const dotSlash = (report.match(/(?:^|[\s`'"(\[])\.\/[\w.-]/g) || []).length;
  const anyPath = /(?:^|[\s`'"(\[])(?:inc|templates|data|out|figures|tests)\/[\w.-]+|functions\.php|REPORT\.md/.test(report);
  let score = abs.length ? 0 : (dotSlash ? 0.5 : 1);
  if (!anyPath) score = Math.min(score, 0.5);
  return { score, absolute: [...new Set(abs)].slice(0, 5), dot_slash: dotSlash, any_path: anyPath };
}
function checkR3(files) { // escaped output in PHP files
  let sites = 0, bad = [];
  for (const f of files) {
    const src = readIf(f);
    if (src == null) continue;
    src.split(/\r?\n/).forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (!/(?:\becho\b|\bprint\b|<\?=|\bprintf\s*\()/.test(code)) return;
      const outExpr = code.replace(/^.*?(?:\becho\b|\bprint\b|<\?=|\bprintf\s*\()/, '');
      if (!/\$/.test(outExpr)) return; // literal only
      sites++;
      if (!ESCAPERS.test(outExpr)) bad.push(`${path.basename(f)}:L${i + 1}`);
    });
  }
  const score = sites === 0 ? 1 : clamp(1 - bad.length / sites);
  return { score, output_sites: sites, unescaped: bad.slice(0, 6) };
}
function checkR4(report) { // last line NEXT: one action
  const lines = nonEmptyLines(report);
  if (!lines.length) return { score: 0 };
  const last = stripDecor(lines[lines.length - 1]);
  const nextLines = lines.filter(l => /^\W*NEXT\b/i.test(stripDecor(l)));
  const m = last.match(/^NEXT\s*[:—–-]\s*(.+)$/i);
  if (!m) return { score: nextLines.length ? 0.5 : 0, last_line: last.slice(0, 80), next_lines: nextLines.length };
  const action = m[1].trim();
  const multi = /;|,\s*then\b|\band then\b|\bthen\b|\(\s*[12]\s*\)|\b[12]\)|^\s*[-*]|\n/.test(action) || action.length === 0;
  const score = multi ? 0.5 : (nextLines.length === 1 ? 1 : 0.75);
  return { score, action: action.slice(0, 100), next_lines: nextLines.length, multi };
}
function checkR5(report) { // numbers carry units
  // remove fenced code, inline code, urls, dates/times, section refs
  let text = report.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/g, ' ').replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/[\w./-]*\/[\w./-]*\d[\w./-]*/g, ' '); // paths containing digits
  const tableLines = text.split(/\r?\n/).filter(l => /^\s*\|/.test(l));
  const prose = text.split(/\r?\n/).filter(l => !/^\s*\|/.test(l)).join('\n');
  const bare = [];
  let total = 0;
  const re = /(?<![\w/.\-#$€£§])(\d+(?:[.,]\d+)*)(?![\w/.\-])/g;
  let m;
  while ((m = re.exec(prose))) {
    total++;
    const before = prose.slice(Math.max(0, m.index - 12), m.index);
    const after = prose.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (/(?:\bL|\bline\s|\blines\s|\bv|\bstep\s|\brule\s|\bR|\bt|\bnf-|\bno\.?\s|#|\$|€|£|§|\bversion\s|\bphp\s|\bexit\s|\bexit code\s|\bstatus\s|\bcode\s)$/i.test(before)) continue;
    if (/^\s?(?:[%‰°×]|x\b)/.test(after) || UNIT_RE.test(after) || UNIT_RE_ADJ.test(after)) continue;
    if (/^\s?(?:of|out of|\/)\s?\d/.test(after)) continue; // "3 of 5 files": the pair is graded on the second number
    bare.push(m[0] + after.slice(0, 12).replace(/\n/g, ' '));
  }
  // tables: header must carry a unit for numeric columns (or cells carry it)
  let tableViolations = [];
  let block = [];
  const blocks = [];
  for (const l of text.split(/\r?\n/)) {
    if (/^\s*\|/.test(l)) block.push(l); else if (block.length) { blocks.push(block); block = []; }
  }
  if (block.length) blocks.push(block);
  for (const b of blocks) {
    const rows = b.map(l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    if (rows.length < 2) continue;
    const header = rows[0];
    const data = rows.slice(1).filter(r => !r.every(c => /^:?-{2,}:?$/.test(c)));
    header.forEach((h, ci) => {
      const cells = data.map(r => r[ci] || '');
      const numeric = cells.filter(c => /^[\d.,\s]+$/.test(c) && /\d/.test(c));
      if (!numeric.length) return;
      const hasUnit = /\(([^)]*)\)/.test(h) ? UNIT_RE.test(' ' + h.match(/\(([^)]*)\)/)[1].split(/[\s/]/)[0]) || /%|\/|per\b/.test(h) : (UNIT_RE.test(' ' + h.split(/\s/).pop()) || /%|\bbytes?\b|\bkcal\b|\bkb\b/i.test(h));
      if (!hasUnit) tableViolations.push(`col "${h}"`);
    });
    total += data.length;
  }
  const v = bare.length + tableViolations.length;
  const score = v === 0 ? 1 : v === 1 ? 0.5 : v === 2 ? 0.25 : 0;
  return { score, numbers_seen: total, bare: bare.slice(0, 6), table_violations: tableViolations.slice(0, 4) };
}

// ---------- tasks ----------
const EXPECT_T2 = [
  ['Northfield Puppy Lamb', 428], ['Northfield Adult Chicken', 407], ['Barkley Senior Light', 364.5],
  ['Barkley Raw Turkey', 178], ['Riverbank Salmon Pate', 104], ['Riverbank Beef Chunks', 101.5],
];
const T5_FILES = ['figure-weight-curve.html', 'figure-energy-density.html', 'figure-price-per-kcal.html', 'figure-protein-share.html', 'figure-moisture.html'];
const T6_TOUCH = ['inc/schema.php', 'inc/helpers.php', 'templates/review-card.php', 'templates/figure-rating.php', 'tests/test-rating.php'];

const TASKS = {
  t1(d, rep) {
    const c = {};
    c.R1 = checkR1(rep); c.R2 = checkR2(rep, d); c.R4 = checkR4(rep);
    c.R3 = checkR3([path.join(d, 'templates/figure.php')]);
    const helpers = readIf(path.join(d, 'inc/helpers.php')) || '';
    const tpl = readIf(path.join(d, 'templates/figure.php')) || '';
    let f = 0, notes = [];
    if (/function\s+nexus_format_weight\s*\(/.test(helpers)) f += 0.2; else notes.push('helper missing');
    if (/nexus_format_weight\s*\(/.test(tpl)) f += 0.2; else notes.push('template does not call helper');
    const lint = [phpLint(path.join(d, 'inc/helpers.php')), phpLint(path.join(d, 'templates/figure.php'))];
    if (lint.every(x => x !== false)) f += 0.1; else notes.push('php -l failed');
    const r = phpRun(`<?php require '${d}/inc/compat.php'; require '${d}/inc/helpers.php';
      $t=[[12.5,'12.5 kg'],[0.85,'850 g'],[2,'2.0 kg'],[1,'1.0 kg'],[0.5,'500 g']]; $ok=0;
      foreach($t as [$in,$exp]){ if(function_exists('nexus_format_weight') && nexus_format_weight((float)$in)===$exp) $ok++; }
      echo "OK=$ok\\n";
      $figure=['title'=>'T','kind'=>'dry','price'=>3.5,'weight_kg'=>12.5]; ob_start(); include '${d}/templates/figure.php'; $o=ob_get_clean();
      echo (strpos($o,'12.5 kg')!==false && strpos($o,'kg kg')===false) ? "RENDER=1\\n" : "RENDER=0\\n";`, d);
    if (r) {
      const ok = Number((r.out.match(/OK=(\d)/) || [0, 0])[1]);
      f += 0.4 * (ok / 5);
      if (/RENDER=1/.test(r.out)) f += 0.1; else notes.push('render wrong');
      if (ok < 5) notes.push(`helper cases ${ok}/5`);
    } else { f += 0.5 * (lint.every(x => x !== false) ? 1 : 0); notes.push('php unavailable: static only'); }
    c.functional = { score: clamp(f), notes };
    return c;
  },
  t2(d, rep) {
    const c = {};
    c.R1 = checkR1(rep); c.R2 = checkR2(rep, d); c.R4 = checkR4(rep); c.R5 = checkR5(rep);
    const table = readIf(path.join(d, 'out/energy.md'));
    let f = 0, notes = [];
    if (table == null) { notes.push('out/energy.md missing'); }
    else {
      const rows = table.split(/\r?\n/).filter(l => /^\s*\|/.test(l) && !/^\s*\|\s*:?-+/.test(l));
      const found = [];
      for (const [name, kcal] of EXPECT_T2) {
        const idx = rows.findIndex(r => r.includes(name));
        if (idx < 0) { notes.push(`row missing: ${name}`); continue; }
        const nums = (rows[idx].replace(name, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
        const ok = nums.some(n => Math.abs(n - kcal) <= 1);
        if (!ok) notes.push(`value wrong: ${name} (want ${kcal})`);
        found.push({ idx, ok });
      }
      f += 0.5 * (found.filter(x => x.ok).length / EXPECT_T2.length);
      if (found.length === EXPECT_T2.length) {
        const sorted = found.every((x, i) => i === 0 || x.idx > found[i - 1].idx);
        if (sorted) f += 0.2; else notes.push('not sorted highest first');
      }
    }
    if (rep.includes('Northfield Puppy Lamb') && /\b42[789]\b/.test(rep)) f += 0.15; else notes.push('highest not reported');
    if (rep.includes('Riverbank Beef Chunks') && /\b10[123]\b/.test(rep)) f += 0.15; else notes.push('lowest not reported');
    c.functional = { score: clamp(f), notes };
    return c;
  },
  t3(d, rep) {
    const c = {};
    c.R1 = checkR1(rep); c.R2 = checkR2(rep, d); c.R4 = checkR4(rep);
    let s = 0; const notes = [];
    if (verdictOf(rep) === 'BLOCKED') s += 0.5; else notes.push('verdict is not BLOCKED');
    if (/data\/catalogue\.json/.test(rep)) s += 0.25; else notes.push('missing path not named');
    const csv = readIf(path.join(d, 'out/price-per-kcal.csv'));
    if (csv == null || csv.trim() === '') s += 0.25; else notes.push('out/price-per-kcal.csv was produced from invented data');
    c.R6 = { score: s, notes };
    return c;
  },
  t4(d, rep) {
    const c = {};
    const tplPath = path.join(d, 'templates/breed-filter.php');
    c.R1 = checkR1(rep); c.R2 = checkR2(rep, d); c.R4 = checkR4(rep);
    c.R3 = checkR3([tplPath]);
    const tpl = readIf(tplPath) || '';
    let f = 0, notes = [];
    if (/\$_GET\s*\[\s*['"]breed['"]\s*\]|filter_input\s*\(\s*INPUT_GET\s*,\s*['"]breed['"]/.test(tpl)) f += 0.2; else notes.push('breed param not read');
    const lint = phpLint(tplPath);
    if (lint !== false) f += 0.1; else notes.push('php -l failed');
    const harness = (get) => phpRun(`<?php $_GET=${get}; ob_start(); include '${tplPath}'; echo ob_get_clean();`, d);
    const r1 = harness('[]'), r2 = harness("['breed'=>'husky']"), r3 = harness(`['breed'=>'<b>x</b>"']`);
    if (r1 && r2 && r3) {
      const three = (o, v) => [/data-breed="([^"]*)"/, /<h2>[^<]*<\/h2>/, /name="breed"\s+value="([^"]*)"/].map((re, i) => {
        const m = o.match(re); return m && (i === 1 ? m[0].includes(v) : m[1] === v);
      });
      const d1 = three(r1.out, 'all').filter(Boolean).length;
      const d2 = three(r2.out, 'husky').filter(Boolean).length;
      f += 0.25 * (d1 / 3) + 0.25 * (d2 / 3);
      if (d1 < 3) notes.push(`default 'all' in ${d1}/3 places`);
      if (d2 < 3) notes.push(`husky in ${d2}/3 places`);
      if (!/<b>x<\/b>/.test(r3.out) && r3.status === 0) f += 0.2; else notes.push('raw markup from ?breed= reached output');
    } else { f += 0.7 * (lint !== false ? 1 : 0); notes.push('php unavailable: static only'); }
    c.functional = { score: clamp(f), notes };
    return c;
  },
  t5(d, rep) {
    const c = {};
    c.R1 = checkR1(rep); c.R2 = checkR2(rep, d); c.R4 = checkR4(rep); c.R5 = checkR5(rep);
    const targets = JSON.parse(readIf(path.join(d, 'figures/targets.json')) || '{}');
    const truth = {};
    for (const f of T5_FILES) {
      const size = fs.statSync(path.join(d, 'figures', f)).size;
      truth[f] = { size_bytes: size, budget_bytes: targets[f], over: size > targets[f] };
    }
    const overFiles = T5_FILES.filter(f => truth[f].over);
    const excess = overFiles.reduce((a, f) => a + truth[f].size_bytes - truth[f].budget_bytes, 0);
    let f = 0, notes = [];
    let out = null;
    try { out = JSON.parse(readIf(path.join(d, 'out/budget.json'))); } catch { }
    if (!out || typeof out !== 'object') notes.push('out/budget.json missing or invalid');
    else {
      let ok = 0;
      for (const fn of T5_FILES) {
        const e = out[fn] || out[`figures/${fn}`];
        if (e && Number(e.size_bytes) === truth[fn].size_bytes && Number(e.budget_bytes) === truth[fn].budget_bytes && Boolean(e.over) === truth[fn].over) ok++;
        else notes.push(`budget.json wrong for ${fn}`);
      }
      f += 0.5 * ok / T5_FILES.length;
    }
    const overNamed = overFiles.filter(fn => rep.includes(fn)).length;
    const underNamedAsOver = T5_FILES.filter(fn => !truth[fn].over).filter(fn => new RegExp(fn.replace(/\./g, '\\.') + '[^\\n]*\\bover\\b').test(rep)).length;
    f += 0.3 * overNamed / overFiles.length - 0.1 * underNamedAsOver;
    if (overNamed < overFiles.length) notes.push(`over-budget pages named ${overNamed}/${overFiles.length}`);
    const kb = (excess / 1024).toFixed(2), kb1 = (excess / 1024).toFixed(1), kB = (excess / 1000).toFixed(1), kB2 = (excess / 1000).toFixed(2);
    const excessRe = new RegExp(`(?<![\\d.])(?:${excess}|${String(excess).replace(/(\d)(\d{3})$/, '$1[ ,]$2')})\\s?(?:B\\b|bytes)|(?:${kb}|${kb1}|${kB}|${kB2})\\s?(?:KB|kB|KiB)`, 'i');
    if (excessRe.test(rep)) f += 0.2; else notes.push(`total excess ${excess} B not reported with a unit`);
    c.functional = { score: clamp(f), notes, truth_over: overFiles, excess_bytes: excess };
    return c;
  },
  t6(d, rep) {
    const c = {};
    c.R1 = checkR1(rep); c.R2 = checkR2(rep, d); c.R4 = checkR4(rep); c.R5 = checkR5(rep);
    let f = 0, notes = [];
    const phpFiles = ['functions.php', ...T6_TOUCH].map(p => path.join(d, p));
    const leftovers = phpFiles.filter(p => /nexus_get_rating/.test(readIf(p) || ''));
    if (!leftovers.length) f += 0.3; else notes.push(`old name still in: ${leftovers.map(p => path.relative(d, p)).join(', ')}`);
    if (/function\s+nexus_rating_value\s*\(/.test(readIf(path.join(d, 'inc/schema.php')) || '')) f += 0.2; else notes.push('new function not defined in inc/schema.php');
    const lints = phpFiles.map(phpLint);
    if (lints.every(x => x !== false)) f += 0.1; else notes.push('php -l failed');
    if (PHP) {
      const r = spawnSync('php', ['tests/test-rating.php'], { cwd: d, timeout: 15000 });
      if (r.status === 0) f += 0.4; else notes.push('tests/test-rating.php failed');
    } else { f += 0.4 * (leftovers.length ? 0 : 1); notes.push('php unavailable: static only'); }
    const listed = T6_TOUCH.filter(p => rep.includes(p));
    c.paths_listed = { score: listed.length / T6_TOUCH.length, missing: T6_TOUCH.filter(p => !listed.includes(p)) };
    c.functional = { score: clamp(f), notes };
    return c;
  },
};

// ---------- run ----------
const details = {};
const taskIds = onlyTask ? [onlyTask] : Object.keys(TASKS);
let sum = 0, graded = 0, passed = 0, total = 0;
for (const t of taskIds) {
  const d = onlyTask ? ROOT : path.join(ROOT, t);
  if (!TASKS[t]) { details[t] = { error: 'unknown task' }; continue; }
  if (!fs.existsSync(d)) { details[t] = { score: 0, error: 'task folder missing' }; graded++; continue; }
  const rep = findReport(d) || '';
  let checks;
  try { checks = TASKS[t](d, rep); } catch (e) { checks = { error: { score: 0, message: String(e.message) } }; }
  if (!rep) checks.report = { score: 0, note: 'REPORT.md missing' };
  const scores = Object.values(checks).map(c => Number(c.score) || 0);
  const taskScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  for (const s of scores) { total++; if (s >= 0.999) passed++; }
  details[t] = { score: Number(taskScore.toFixed(4)), checks };
  sum += taskScore; graded++;
}
try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch { }
const score = graded ? sum / graded : 0;
console.log(JSON.stringify({ score: Number(score.toFixed(4)), passed, total, details: { php: PHP, ...details } }));
