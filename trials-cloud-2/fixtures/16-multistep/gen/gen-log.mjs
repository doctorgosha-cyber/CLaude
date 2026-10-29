// Generates task/logs/app.log from the buggy handler so the grams in the log match the code.
import { writeFileSync } from 'node:fs';
import { handlePortion } from '../task/src/api.mjs';

let seed = 20261027;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const hex = (n) => { let s = ''; for (let i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(rnd() * 16)]; return s; };

const cats = ['ck-chicken-dry', 'ck-tuna-dry', 'ck-indoor-light', 'ck-kitten-growth', 'ck-senior-care', 'ck-chicken-dry', 'ck-tuna-dry', 'ck-chicken-pate-wet'];
const dogs = ['dg-beef-dry', 'dg-chicken-rice', 'dg-puppy-large', 'dg-senior-light', 'dg-beef-dry'];
const newCat = ['ck-salmon-soft-bites', 'ck-ocean-fish-dry'];
const newDog = ['dg-lamb-rice-dry'];

let t = Date.UTC(2026, 9, 27, 6, 58, 12, 404); // 2026-10-27
const lines = [];
function stamp(ms) { t += ms; return new Date(t).toISOString(); }
function log(level, msg, ms = 1000 + rnd() * 240000) { lines.push(`${stamp(ms)} ${level.padEnd(5)} ${msg}`); }

log('INFO', 'portion-service v1.4.0 starting pid=18422 node=v22.22.0', 0);
log('INFO', 'config: port=8080 defaultUnits=metric localeUnits=on factors=2026-10-20', 40);
log('INFO', 'catalogue: loaded data/catalogue.json version=2026-10-20 products=14 (4 added since 2026-10-06)', 112);
log('INFO', 'listening on :8080', 8);

function req(q, user, ms) {
  const res = handlePortion(q);
  const dur = Math.round(4 + rnd() * 30);
  const tail = res.status === 200 ? `-> 200 grams=${res.body.grams} kcal=${res.body.kcalPerDay}` : `-> ${res.status} "${res.body.error}"`;
  log(res.status === 200 ? 'INFO' : 'WARN', `req=${hex(6)} user=${user} GET /portion?${q} ${tail} ${dur}ms`, ms);
}

const plan = [];
// 64 ordinary requests + 3 complaining accounts + a few stragglers, in shuffled order
for (let i = 0; i < 36; i++) {
  const w = (2.8 + rnd() * 3.4).toFixed(1);
  const stage = pick(['adult', 'adult', 'neutered_adult', 'neutered_adult', 'senior', 'kitten', 'neutered']);
  const act = pick(['normal', 'normal', 'low', 'high']);
  const units = rnd() < 0.12 ? '&units=metric' : '';
  plan.push([`species=cat&weight=${w}&stage=${stage}&activity=${act}${units}&product=${pick(cats)}`, `u_${String(Math.floor(rnd() * 4000)).padStart(4, '0')}`]);
}
for (let i = 0; i < 24; i++) {
  const w = (6 + rnd() * 30).toFixed(1);
  const stage = pick(['adult', 'adult', 'neutered_adult', 'senior', 'puppy', 'adult']);
  const act = pick(['normal', 'normal', 'low', 'high']);
  const units = rnd() < 0.12 ? '&units=metric' : '';
  plan.push([`species=dog&weight=${w}&stage=${stage}&activity=${act}${units}&product=${pick(dogs)}`, `u_${String(Math.floor(rnd() * 4000)).padStart(4, '0')}`]);
}
// new products, metric users (tiny portions, nobody complained except u_1536)
plan.push(['species=cat&weight=3.9&stage=adult&activity=normal&product=ck-salmon-soft-bites', 'u_3307']);
plan.push(['species=cat&weight=4.6&stage=adult&activity=low&product=ck-ocean-fish-dry', 'u_0412']);
plan.push(['species=dog&weight=24.5&stage=adult&activity=normal&product=dg-lamb-rice-dry', 'u_2750']);
// one non-complaining imperial user on a new product (errors partly cancel)
plan.push(['species=dog&weight=48&stage=adult&activity=high&units=imperial&product=dg-lamb-rice-dry', 'u_1981']);
// new wet product with kcal/can (nobody complained; the number is merely 4x too low)
plan.push(['species=dog&weight=21&stage=adult&activity=normal&product=dg-beef-stew-wet', 'u_0655']);
// red herring: adult dog on senior food, served correctly
plan.push(['species=dog&weight=24&stage=adult&activity=normal&product=dg-senior-light', 'u_3078']);
// the support tickets
plan.push(['species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry', 'u_2291']);
plan.push(['species=cat&weight=11.5&stage=neutered_adult&activity=low&units=imperial&product=ck-senior-care', 'u_0874']);
plan.push(['species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry', 'u_1536']);
// a few bad requests
plan.push(['species=cat&stage=adult&product=ck-tuna-dry', 'u_0098']);
plan.push(['species=cat&weight=4.1&product=dg-beef-dry', 'u_2104']);
plan.push(['species=dog&weight=abc&product=dg-beef-dry', 'u_1777']);
plan.push(['species=cat&weight=4.4&units=lbs&product=ck-tuna-dry', 'u_3390']);

for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }
let count = 0;
for (const [q, user] of plan) {
  req(q, user);
  count++;
  if (count === 28) log('WARN', 'catalogue: refresh check skipped (feed endpoint timeout after 5000ms)', 300);
  if (count === 51) log('INFO', 'health: ok heap=41MB uptime=7h12m', 200);
}
log('INFO', 'health: ok heap=43MB uptime=11h02m', 500000);
writeFileSync(new URL('../task/logs/app.log', import.meta.url), lines.join('\n') + '\n');
console.log(`${lines.length} lines`);
