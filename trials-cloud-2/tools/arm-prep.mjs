// Create fresh run copies for an A/B skill trial: node tools/arm-prep.mjs <NN-name> <reps>  → runs/<NN-name>/work/{A,B}-<rep>/ from fixtures/<NN-name>/task/
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
const [name, reps = '3'] = process.argv.slice(2);
const src = `fixtures/${name}/task`; if (!existsSync(src)) throw new Error(`missing ${src}`);
for (const arm of ['A', 'B']) for (let r = 1; r <= Number(reps); r++) { const d = `runs/${name}/work/${arm}-${r}`; rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); cpSync(src, d, { recursive: true }); console.log(d); }
