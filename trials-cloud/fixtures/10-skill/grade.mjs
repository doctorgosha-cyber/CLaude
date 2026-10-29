// Grader for trial 10: copies the hidden tests next to a run's src/ and runs them with node --test. Prints JSON.
// Usage: node grade.mjs <task-id> <run-dir>
import { spawnSync } from 'node:child_process'; import { mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs'; import { resolve, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)); const [task, run] = process.argv.slice(2);
const dir = resolve(run, '__hidden__'); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir);
copyFileSync(resolve(here, 'hidden-tests', `${task}.test.mjs`), resolve(dir, `${task}.test.mjs`));
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', resolve(dir, `${task}.test.mjs`)], { cwd: run, encoding: 'utf8', timeout: 60000 });
const pass = (r.stdout.match(/^ok \d+/gm) ?? []).length, fail = (r.stdout.match(/^not ok \d+/gm) ?? []).length;
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ task, run, passed: pass, failed: fail, total: pass + fail, crashed: r.status !== 0 && pass + fail === 0, stderr: r.stderr.slice(0, 400) }));
