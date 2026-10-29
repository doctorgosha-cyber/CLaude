#!/usr/bin/env node
// Usage: node grade.mjs <run-dir>  → one JSON line {"score":0..1,"passed":n,"total":m,"details":{...}}
// Shares the harness with 12-frontend-design so both tasks are graded identically.
import { grade } from '../12-frontend-design/hidden/harness.mjs';
import * as spec from './hidden/tests.mjs';
const runDir = process.argv[2];
if (!runDir) { console.error('usage: node grade.mjs <run-dir>'); process.exit(2); }
try { console.log(JSON.stringify(await grade(spec, runDir))); process.exit(0); }
catch (e) { console.log(JSON.stringify({ score: 0, passed: 0, total: 0, details: { error: String(e && e.stack || e).slice(0, 500) } })); process.exit(1); }
