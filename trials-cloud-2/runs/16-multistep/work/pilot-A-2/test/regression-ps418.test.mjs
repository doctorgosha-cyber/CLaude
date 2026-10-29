import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct, normaliseProduct } from '../src/catalogue.mjs';
import { dailyKcal } from '../src/needs.mjs';
import { roundGrams } from '../src/format.mjs';
import { parseEnergyUnit, lbToKg } from '../src/units.mjs';

test('PS-418: imperial weight is pounds (u_2291)', () => {
  const imperial = handlePortion('species=cat&weight=10&stage=adult&units=imperial&product=ck-chicken-dry');
  const metric = handlePortion({ species: 'cat', weight: lbToKg(10), stage: 'adult', product: 'ck-chicken-dry' });
  assert.equal(imperial.status, 200);
  assert.equal(imperial.body.kcalPerDay, metric.body.kcalPerDay);
  assert.equal(imperial.body.weight, 10);
  assert.equal(imperial.body.units, 'imperial');
  assert.ok(imperial.body.grams > 55 && imperial.body.grams < 80, `grams ${imperial.body.grams}`);
});

test('PS-418: legacy stage aliases resolve, unknown stages are rejected (u_0874)', () => {
  assert.equal(
    dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered_adult' }),
    dailyKcal({ species: 'cat', weightKg: 4, stage: 'neutered' }),
  );
  assert.throws(() => dailyKcal({ species: 'cat', weightKg: 4, stage: 'teenager' }), RangeError);
  const res = handlePortion('species=cat&weight=4&stage=teenager&product=ck-chicken-dry');
  assert.equal(res.status, 400);
  assert.match(res.body.error, /stage/);
  assert.equal(handlePortion('species=dog&weight=10&stage=puppy_growth&product=dg-puppy-large').status, 200);
});

test('PS-418: feed unit spellings are normalised (u_1536)', () => {
  assert.equal(parseEnergyUnit('kcal/kg '), 'kcal/kg');
  assert.equal(parseEnergyUnit('kcal per kg'), 'kcal/kg');
  assert.equal(parseEnergyUnit('KCAL / 100 G'), 'kcal/100g');
  assert.equal(parseEnergyUnit('calories'), undefined);
  const products = loadCatalogue();
  assert.equal(findProduct(products, 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(products, 'dg-lamb-rice-dry').kcalPer100g, 356);
  assert.equal(findProduct(products, 'ck-salmon-soft-bites').kcalPer100g, 385);
  const res = handlePortion('species=cat&weight=3.8&stage=adult&product=ck-ocean-fish-dry');
  assert.ok(res.body.grams > 45 && res.body.grams < 65, `grams ${res.body.grams}`);
});

test('PS-402: a catalogue with an implausible energy density or unknown unit is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cat-'));
  const write = (products) => {
    const file = join(dir, 'c.json');
    writeFileSync(file, JSON.stringify({ products }));
    return file;
  };
  const base = { id: 'x', name: 'X', species: 'cat', added: '2026-01-01' };
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 3850, unit: 'kcal/100g' } }])), /implausible/);
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 120, unit: 'kcal/100g' } }])), /implausible/);
  assert.throws(() => loadCatalogue(write([{ ...base, energy: { value: 380, unit: 'joules' } }])), /unknown energy unit/);
  assert.equal(normaliseProduct({ ...base, energy: { value: 3850, unit: 'kcal/kg' } }).kcalPer100g, 385);
});

test('grams are rounded to whole grams, no scoop or minimum', () => {
  assert.equal(roundGrams(66.2), 66);
  assert.equal(roundGrams(5.5), 6);
  assert.equal(roundGrams(22.4), 22);
});
