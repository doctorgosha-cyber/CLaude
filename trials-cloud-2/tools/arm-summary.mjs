// Summarise an A/B skill trial: node tools/arm-summary.mjs <NN-name>
// reads runs/<NN>/usage.jsonl ({run, arm, tokens, tool_uses, duration_ms}) and runs/<NN>/grades.jsonl ({run, score, passed, total, ...})
import { readFileSync, writeFileSync } from 'node:fs';
const name = process.argv[2]; const dir = `runs/${name}`;
const lines = f => readFileSync(`${dir}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const usage = Object.fromEntries(lines('usage.jsonl').map(u => [u.run, u])); const grades = Object.fromEntries(lines('grades.jsonl').map(g => [g.run, g]));
const rows = Object.keys(grades).sort().map(run => ({ run, arm: run.startsWith('B') ? 'B' : 'A', score: grades[run].score, passed: grades[run].passed, total: grades[run].total, tokens: usage[run]?.tokens ?? null, tool_uses: usage[run]?.tool_uses ?? null, seconds: usage[run] ? Math.round(usage[run].duration_ms / 100) / 10 : null }));
const mean = (rs, k) => rs.length ? rs.reduce((s, r) => s + (r[k] ?? 0), 0) / rs.length : null;
const sum = {}; for (const arm of ['A', 'B']) { const rs = rows.filter(r => r.arm === arm); sum[arm] = { runs: rs.length, mean_score: +mean(rs, 'score').toFixed(3), min_score: Math.min(...rs.map(r => r.score)), max_score: Math.max(...rs.map(r => r.score)), mean_tokens: Math.round(mean(rs, 'tokens')), mean_tool_uses: +mean(rs, 'tool_uses').toFixed(2), mean_seconds: +mean(rs, 'seconds').toFixed(1) }; }
const pct = (b, a) => a ? +((b / a - 1) * 100).toFixed(1) : null;
const delta = { score_points: +((sum.B.mean_score - sum.A.mean_score) * 100).toFixed(1), tokens_pct: pct(sum.B.mean_tokens, sum.A.mean_tokens), tool_uses_pct: pct(sum.B.mean_tool_uses, sum.A.mean_tool_uses), seconds_pct: pct(sum.B.mean_seconds, sum.A.mean_seconds) };
const out = { trial: name, rows, summary: sum, delta_B_vs_A: delta };
writeFileSync(`${dir}/summary.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify({ summary: sum, delta }, null, 1));
