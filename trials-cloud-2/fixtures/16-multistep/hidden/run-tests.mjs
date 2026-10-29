// Hidden test runner. Usage: node run-tests.mjs <run-dir> <scratch-dir>
// Imports the candidate's modules from <run-dir>/src, writes temp catalogues into <scratch-dir>,
// and prints one line "__RESULT__{json}" with per-test pass/fail.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const runDir = resolve(process.argv[2]);
const scratch = resolve(process.argv[3]);
mkdirSync(scratch, { recursive: true });

const results = {};
const tests = [];
function test(id, fn) { tests.push([id, fn]); }
const near = (a, b, tol) => typeof a === 'number' && Number.isFinite(a) && Math.abs(a - b) <= tol;
function ok(cond, msg) { if (!cond) throw new Error(msg); }

async function mod(name) {
  return import(pathToFileURL(join(runDir, 'src', name)).href);
}

function tmpCatalogue(id, products) {
  const file = join(scratch, `cat-${id}.json`);
  writeFileSync(file, JSON.stringify({ version: 'test', products }, null, 2));
  return file;
}
const prod = (id, value, unit, species = 'cat') => ({ id, name: id, species, energy: { value, unit }, added: '2026-10-20' });

// ---- (b) unit-spelling normalisation (via loadCatalogue on temp files) ----
test('U1 trailing space "kcal/kg "', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  const ps = loadCatalogue(tmpCatalogue('u1', [prod('a', 4120, 'kcal/kg ')]));
  ok(near(ps[0].kcalPer100g, 412, 1e-6), `got ${ps[0].kcalPer100g}`);
});
test('U2 "kcal per kg"', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  const ps = loadCatalogue(tmpCatalogue('u2', [prod('a', 3560, 'kcal per kg')]));
  ok(near(ps[0].kcalPer100g, 356, 1e-6), `got ${ps[0].kcalPer100g}`);
});
test('U3 upper case and inner spaces "KCAL/KG", "kcal / kg"', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  const ps = loadCatalogue(tmpCatalogue('u3', [prod('a', 3920, 'KCAL/KG'), prod('b', 3300, 'kcal / kg')]));
  ok(near(ps[0].kcalPer100g, 392, 1e-6), `KCAL/KG got ${ps[0].kcalPer100g}`);
  ok(near(ps[1].kcalPer100g, 330, 1e-6), `kcal / kg got ${ps[1].kcalPer100g}`);
});
test('U4 per-100 g spellings stay unchanged', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  const ps = loadCatalogue(tmpCatalogue('u4', [prod('a', 380, 'kcal/100 g'), prod('b', 355, 'Kcal per 100 g'), prod('c', 372, 'kcal/100g')]));
  ok(near(ps[0].kcalPer100g, 380, 1e-6), `kcal/100 g got ${ps[0].kcalPer100g}`);
  ok(near(ps[1].kcalPer100g, 355, 1e-6), `Kcal per 100 g got ${ps[1].kcalPer100g}`);
  ok(near(ps[2].kcalPer100g, 372, 1e-6), `kcal/100g got ${ps[2].kcalPer100g}`);
});

// ---- (a) shipped catalogue sanity + PS-402 guard ----
test('C1 shipped catalogue: 12 products, all 250-600 kcal/100 g', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  const ps = loadCatalogue();
  ok(ps.length === 12, `expected 12 products, got ${ps.length}`);
  for (const p of ps) ok(p.kcalPer100g >= 250 && p.kcalPer100g <= 600, `${p.id} is ${p.kcalPer100g}`);
});
test('C2 the three new products have the right energy density', async () => {
  const { loadCatalogue, findProduct } = await mod('catalogue.mjs');
  const ps = loadCatalogue();
  for (const [id, v] of [['ck-salmon-soft-bites', 385], ['ck-ocean-fish-dry', 412], ['dg-lamb-rice-dry', 356]]) {
    const p = findProduct(ps, id);
    ok(p, `${id} missing`);
    ok(near(p.kcalPer100g, v, 1e-6), `${id} got ${p.kcalPer100g}, expected ${v}`);
  }
});
test('C3 loader throws on a per-kg value mislabelled per 100 g (3850 kcal/100g)', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  let threw = false;
  try { loadCatalogue(tmpCatalogue('c3', [prod('ok', 372, 'kcal/100g'), prod('bad', 3850, 'kcal/100g')])); } catch { threw = true; }
  ok(threw, 'loadCatalogue did not throw');
});
test('C4 loader throws below 250 and above 600 after normalisation', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  let low = false, high = false;
  try { loadCatalogue(tmpCatalogue('c4a', [prod('bad', 40, 'kcal/100g')])); } catch { low = true; }
  try { loadCatalogue(tmpCatalogue('c4b', [prod('bad', 7000, 'kcal/kg')])); } catch { high = true; }
  ok(low, 'did not throw for 40 kcal/100g');
  ok(high, 'did not throw for 7000 kcal/kg (=700 kcal/100g)');
});
test('C5 loader throws on a unit it cannot interpret ("kcal/lb" 1700)', async () => {
  const { loadCatalogue } = await mod('catalogue.mjs');
  let threw = false;
  try { loadCatalogue(tmpCatalogue('c5', [prod('bad', 1700, 'kcal/lb')])); } catch { threw = true; }
  ok(threw, 'loadCatalogue did not throw');
});

// ---- (c) imperial weights ----
test('I1 units=imperial: 10 lb cat needs ~261 kcal/day (not ~472)', async () => {
  const { handlePortion } = await mod('api.mjs');
  const r = handlePortion('species=cat&weight=10&units=imperial&product=ck-chicken-dry');
  ok(r.status === 200, `status ${r.status}`);
  ok(near(r.body.kcalPerDay, 261.1, 1.5), `kcalPerDay ${r.body.kcalPerDay}`);
});
test('I2 10 lb imperial equals 4.5359 kg metric', async () => {
  const { handlePortion } = await mod('api.mjs');
  const a = handlePortion('species=cat&weight=10&units=imperial&stage=adult&activity=normal&product=ck-tuna-dry');
  const b = handlePortion('species=cat&weight=4.5359&stage=adult&activity=normal&product=ck-tuna-dry');
  ok(a.status === 200 && b.status === 200, `status ${a.status}/${b.status}`);
  ok(near(a.body.grams, b.body.grams, 1), `grams ${a.body.grams} vs ${b.body.grams}`);
  ok(near(a.body.kcalPerDay, b.body.kcalPerDay, 0.5), `kcal ${a.body.kcalPerDay} vs ${b.body.kcalPerDay}`);
});
test('I3 units omitted behaves as metric', async () => {
  const { handlePortion } = await mod('api.mjs');
  const a = handlePortion('species=cat&weight=4.2&product=ck-chicken-dry');
  const b = handlePortion('species=cat&weight=4.2&units=metric&product=ck-chicken-dry');
  ok(a.status === 200 && b.status === 200, `status ${a.status}/${b.status}`);
  ok(a.body.grams === b.body.grams && near(a.body.kcalPerDay, 246.4, 1), `grams ${a.body.grams} vs ${b.body.grams}, kcal ${a.body.kcalPerDay}`);
});
test('I4 22.0462 lb dog equals 10 kg dog', async () => {
  const { handlePortion } = await mod('api.mjs');
  const a = handlePortion({ species: 'dog', weight: 22.0462, units: 'imperial', product: 'dg-chicken-rice' });
  const b = handlePortion({ species: 'dog', weight: 10, product: 'dg-chicken-rice' });
  ok(a.status === 200 && b.status === 200, `status ${a.status}/${b.status}`);
  ok(near(a.body.kcalPerDay, 629.8, 2) && near(b.body.kcalPerDay, 629.8, 2), `kcal ${a.body.kcalPerDay} vs ${b.body.kcalPerDay}`);
});
test('I5 unknown units value is a 400', async () => {
  const { handlePortion } = await mod('api.mjs');
  const r = handlePortion('species=cat&weight=4.4&units=lbs&product=ck-tuna-dry');
  ok(r.status === 400, `status ${r.status}`);
});
test('I6 11.5 lb senior cat, low activity, Senior Care -> ~225.9 kcal', async () => {
  const { handlePortion } = await mod('api.mjs');
  const r = handlePortion('species=cat&weight=11.5&stage=senior&activity=low&units=imperial&product=ck-senior-care');
  ok(r.status === 200, `status ${r.status}`);
  ok(near(r.body.kcalPerDay, 225.9, 1.5), `kcalPerDay ${r.body.kcalPerDay}`);
});

// ---- (d) stage aliases and unknown stages ----
test('D1 legacy stage neutered_adult uses the neutered factor (cat 4 kg -> 198 kcal)', async () => {
  const { handlePortion } = await mod('api.mjs');
  const r = handlePortion('species=cat&weight=4&stage=neutered_adult&activity=normal&product=ck-chicken-dry');
  ok(r.status === 200, `status ${r.status}`);
  ok(near(r.body.kcalPerDay, 198, 1), `kcalPerDay ${r.body.kcalPerDay} (adult fallback would be 237.6)`);
});
test('D2 stage=neutered and stage=neutered_adult give the same portion', async () => {
  const { handlePortion } = await mod('api.mjs');
  const a = handlePortion('species=cat&weight=5.2&stage=neutered&activity=low&product=ck-indoor-light');
  const b = handlePortion('species=cat&weight=5.2&stage=neutered_adult&activity=low&product=ck-indoor-light');
  ok(a.status === 200 && b.status === 200, `status ${a.status}/${b.status}`);
  ok(a.body.grams === b.body.grams && near(a.body.kcalPerDay, b.body.kcalPerDay, 0.2), `grams ${a.body.grams} vs ${b.body.grams}`);
  ok(near(a.body.kcalPerDay, 204.9, 1.5), `kcal ${a.body.kcalPerDay}`);
});
test('D3 dailyKcal resolves aliases: neutered_adult == neutered for cat and dog', async () => {
  const { dailyKcal } = await mod('needs.mjs');
  const a = dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered_adult' });
  ok(near(a, 198, 0.2), `cat neutered_adult ${a}`);
  const d1 = dailyKcal({ species: 'dog', weightKg: 20, stage: 'neutered_adult' });
  const d2 = dailyKcal({ species: 'dog', weightKg: 20, stage: 'neutered' });
  ok(near(d1, d2, 1e-6) && near(d1, 993.0, 1), `dog ${d1} vs ${d2}`);
});
test('D4 unknown stage is a 400 from the API, not a silent adult fallback', async () => {
  const { handlePortion } = await mod('api.mjs');
  for (const q of ['species=cat&weight=4&stage=bogus&product=ck-chicken-dry', 'species=dog&weight=20&stage=kitten&product=dg-beef-dry', 'species=cat&weight=4&stage=Adult&product=ck-chicken-dry']) {
    const r = handlePortion(q);
    ok(r.status === 400, `${q}: status ${r.status}`);
    ok(typeof r.body?.error === 'string' && r.body.error.length > 0, `${q}: no error message`);
  }
});
test('D5 dailyKcal throws on an unknown stage', async () => {
  const { dailyKcal } = await mod('needs.mjs');
  let threw = false;
  try { dailyKcal({ species: 'cat', weightKg: 4, stage: 'bogus' }); } catch { threw = true; }
  ok(threw, 'did not throw');
});
test('D6 other aliases: puppy_growth -> puppy, growth -> kitten', async () => {
  const { handlePortion } = await mod('api.mjs');
  const a = handlePortion('species=dog&weight=9&stage=puppy_growth&activity=normal&product=dg-puppy-large');
  const b = handlePortion('species=dog&weight=9&stage=puppy&activity=normal&product=dg-puppy-large');
  const c = handlePortion('species=cat&weight=1.8&stage=growth&activity=normal&product=ck-kitten-growth');
  ok(a.status === 200 && b.status === 200 && c.status === 200, `status ${a.status}/${b.status}/${c.status}`);
  ok(near(a.body.kcalPerDay, 1091.2, 2) && near(b.body.kcalPerDay, 1091.2, 2), `puppy kcal ${a.body.kcalPerDay} vs ${b.body.kcalPerDay}`);
  ok(near(c.body.kcalPerDay, 272, 1), `growth kcal ${c.body.kcalPerDay}`);
});

// ---- (e) rounding: half away from zero to 1 g, no scoop step, no minimum ----
test('F1 roundGrams(42.5) = 43 (half away from zero)', async () => {
  const { roundGrams } = await mod('format.mjs');
  ok(roundGrams(42.5) === 43, `got ${roundGrams(42.5)}`);
  ok(roundGrams(0.5) === 1, `0.5 got ${roundGrams(0.5)}`);
});
test('F2 roundGrams rounds to 1 g, not to a 5 g scoop', async () => {
  const { roundGrams } = await mod('format.mjs');
  ok(roundGrams(42.49) === 42, `42.49 got ${roundGrams(42.49)}`);
  ok(roundGrams(66.4) === 66, `66.4 got ${roundGrams(66.4)}`);
  ok(roundGrams(67.6) === 68, `67.6 got ${roundGrams(67.6)}`);
  ok(roundGrams(123) === 123, `123 got ${roundGrams(123)}`);
});
test('F3 roundGrams has no minimum portion', async () => {
  const { roundGrams } = await mod('format.mjs');
  ok(roundGrams(7.3) === 7, `7.3 got ${roundGrams(7.3)}`);
  ok(roundGrams(12.5) === 13, `12.5 got ${roundGrams(12.5)}`);
  ok(roundGrams(0.4) === 0, `0.4 got ${roundGrams(0.4)}`);
});
test('F4 formatPortion uses the same rounding', async () => {
  const { formatPortion } = await mod('format.mjs');
  const product = { id: 'x', name: 'X', kcalPer100g: 372 };
  const g = (grams) => formatPortion({ grams, kcalPerDay: 100, weight: 1, units: 'metric', product }).grams;
  ok(g(66.2) === 66, `66.2 got ${g(66.2)}`);
  ok(g(21.5) === 22, `21.5 got ${g(21.5)}`);
  ok(g(3.2) === 3, `3.2 got ${g(3.2)}`);
});
test('F5 end to end: 0.9 kg senior cat, low activity, Indoor Light -> 19 g', async () => {
  const { handlePortion } = await mod('api.mjs');
  const r = handlePortion('species=cat&weight=0.9&stage=senior&activity=low&product=ck-indoor-light');
  ok(r.status === 200, `status ${r.status}`);
  ok(r.body.grams === 19, `grams ${r.body.grams}`);
});
test('F6 end to end: 0.7 kg adult cat, low activity, Tuna -> 15 g', async () => {
  const { handlePortion } = await mod('api.mjs');
  const r = handlePortion('species=cat&weight=0.7&stage=adult&activity=low&product=ck-tuna-dry');
  ok(r.status === 200, `status ${r.status}`);
  ok(r.body.grams === 15, `grams ${r.body.grams}`);
});

// ---- end to end for six animals (incl. the three ticket lines) ----
const E2E = [
  ['E1 cat 4.2 kg adult normal, Chicken & Rice', 'species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry', 66, 246.4],
  ['E2 ticket u_2291: cat 10 lb adult normal, Chicken & Rice (log said 125 g)', 'species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry', 70, 261.1],
  ['E3 ticket u_0874: cat 11.5 lb neutered_adult low, Senior Care (log said 130 g)', 'species=cat&weight=11.5&stage=neutered_adult&activity=low&units=imperial&product=ck-senior-care', 60, 205.4],
  ['E4 ticket u_1536: cat 3.8 kg adult normal, Ocean Fish Dry (log said 20 g)', 'species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry', 55, 228.6],
  ['E5 cat 12 lb neutered_adult high, Ocean Fish Dry', 'species=cat&weight=12&stage=neutered_adult&activity=high&units=imperial&product=ck-ocean-fish-dry', 73, 299.3],
  ['E6 dog 55 lb adult normal, Lamb & Rice Dry', 'species=dog&weight=55&stage=adult&activity=normal&units=imperial&product=dg-lamb-rice-dry', 351, 1250.2],
  ['E7 dog 28 kg neutered normal, Beef & Barley', 'species=dog&weight=28&stage=neutered&activity=normal&product=dg-beef-dry', 350, 1278.1],
  ['E8 cat 10 lb senior low, Salmon Soft Bites', 'species=cat&weight=10&stage=senior&activity=low&units=imperial&product=ck-salmon-soft-bites', 53, 203.4],
  ['E9 kitten 1.8 kg, Kitten Growth (per-kg row)', 'species=cat&weight=1.8&stage=kitten&activity=normal&product=ck-kitten-growth', 67, 272],
];
for (const [name, q, grams, kcal] of E2E) {
  test(name, async () => {
    const { handlePortion } = await mod('api.mjs');
    const r = handlePortion(q);
    ok(r.status === 200, `status ${r.status} ${JSON.stringify(r.body)}`);
    ok(r.body.grams === grams, `grams ${r.body.grams}, expected ${grams}`);
    ok(near(r.body.kcalPerDay, kcal, kcal * 0.005), `kcalPerDay ${r.body.kcalPerDay}, expected ${kcal}`);
    ok(r.body.product && r.body.product.id === q.match(/product=([^&]+)/)[1], 'product id missing from body');
  });
}

// ---- regression / errors ----
test('R1 existing public API unchanged', async () => {
  const { dailyGrams } = await mod('calculator.mjs');
  const { dailyKcal, restingEnergy } = await mod('needs.mjs');
  const { kcalPerKgTo100g, parseNumber } = await mod('units.mjs');
  const { roundKcal, formatPortion } = await mod('format.mjs');
  const { loadCatalogue, findProduct } = await mod('catalogue.mjs');
  ok(dailyGrams(300, 400) === 75, 'dailyGrams(300,400)');
  ok(near(restingEnergy(4), 198.0, 0.1), 'restingEnergy(4)');
  ok(near(dailyKcal({ species: 'cat', weightKg: 4, stage: 'adult', activity: 'normal' }), 237.6, 0.1), 'dailyKcal cat 4 kg');
  ok(kcalPerKgTo100g(4080) === 408, 'kcalPerKgTo100g');
  ok(Number.isNaN(parseNumber('abc')) && parseNumber('4.2') === 4.2, 'parseNumber');
  ok(roundKcal(246.44) === 246.4, 'roundKcal');
  const body = formatPortion({ grams: 66.2, kcalPerDay: 246.44, weight: 4.2, units: 'metric', product: { id: 'x', name: 'X', kcalPer100g: 372 } });
  ok(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['grams', 'kcalPerDay', 'product', 'units', 'weight']), 'response shape');
  ok(findProduct(loadCatalogue(), 'ck-kitten-growth').kcalPer100g === 408, 'kitten growth 408');
});
test('R2 missing or invalid weight is a 400 with an error message', async () => {
  const { handlePortion } = await mod('api.mjs');
  for (const q of ['species=cat&stage=adult&product=ck-tuna-dry', 'species=dog&weight=abc&product=dg-beef-dry', 'species=dog&weight=-2&product=dg-beef-dry', 'species=cat&weight=0&units=imperial&product=ck-tuna-dry']) {
    const r = handlePortion(q);
    ok(r.status === 400, `${q}: status ${r.status}`);
    ok(typeof r.body?.error === 'string' && r.body.error.length > 0, `${q}: no error message`);
  }
});
test('R3 unknown product 404, species mismatch 400, bad species/activity 400', async () => {
  const { handlePortion } = await mod('api.mjs');
  ok(handlePortion({ species: 'dog', weight: 20, product: 'nope' }).status === 404, 'unknown product');
  ok(handlePortion('species=cat&weight=4.1&product=dg-beef-dry').status === 400, 'species mismatch');
  ok(handlePortion('species=hamster&weight=0.1&product=ck-tuna-dry').status === 400, 'bad species');
  ok(handlePortion('species=cat&weight=4.1&activity=lazy&product=ck-tuna-dry').status === 400, 'bad activity');
});

for (const [id, fn] of tests) {
  try { await fn(); results[id] = { pass: true }; }
  catch (e) { results[id] = { pass: false, error: String(e && e.message ? e.message : e).slice(0, 300) }; }
}
process.stdout.write('\n__RESULT__' + JSON.stringify(results) + '\n');
