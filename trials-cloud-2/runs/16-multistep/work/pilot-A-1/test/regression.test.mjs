import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { handlePortion } from '../src/api.mjs';
import { loadCatalogue, findProduct, parseEnergyUnit } from '../src/catalogue.mjs';

const fixture = (name) => join(dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

test('PS-418: every product in the shipped catalogue is 250-600 kcal/100g', () => {
  for (const p of loadCatalogue()) {
    assert.ok(p.kcalPer100g >= 250 && p.kcalPer100g <= 600, `${p.id} = ${p.kcalPer100g}`);
  }
  assert.equal(findProduct(loadCatalogue(), 'ck-ocean-fish-dry').kcalPer100g, 412);
  assert.equal(findProduct(loadCatalogue(), 'ck-salmon-soft-bites').kcalPer100g, 385);
  assert.equal(findProduct(loadCatalogue(), 'dg-lamb-rice-dry').kcalPer100g, 356);
});

test('loader tolerates unit spelling variants and rejects unknown units', () => {
  for (const u of ['kcal/kg', 'kcal/kg ', ' Kcal / KG', 'kcal per kg', 'KCAL PER KG', 'kcal/1000g']) {
    assert.equal(parseEnergyUnit(u), 'perKg', u);
  }
  for (const u of ['kcal/100g', 'kcal/100 g', 'kcal per 100g', 'Kcal Per 100 G']) {
    assert.equal(parseEnergyUnit(u), 'per100g', u);
  }
  assert.equal(parseEnergyUnit('kJ/100g'), undefined);
  assert.throws(() => loadCatalogue(fixture('unknown-unit.json')), /unknown energy unit/);
});

test('loader throws when a normalised product is outside 250-600 kcal/100g', () => {
  assert.throws(() => loadCatalogue(fixture('too-high.json')), /outside 250-600/);
  assert.throws(() => loadCatalogue(fixture('too-low.json')), /outside 250-600/);
  assert.throws(() => loadCatalogue(fixture('non-numeric.json')), /no numeric energy/);
  assert.equal(loadCatalogue(fixture('sloppy-unit-ok.json'))[0].kcalPer100g, 412);
});

test('PS-418: imperial weight is converted from lb before computing the portion', () => {
  const lb = handlePortion('species=cat&weight=10&units=imperial&product=ck-chicken-dry');
  const kg = handlePortion('species=cat&weight=4.5359&units=metric&product=ck-chicken-dry');
  assert.equal(lb.status, 200);
  assert.equal(lb.body.grams, kg.body.grams);
  assert.equal(lb.body.grams, 70);
  assert.equal(lb.body.weight, 10);
  assert.equal(lb.body.units, 'imperial');

  const senior = handlePortion('species=cat&weight=11.5&stage=senior&activity=low&units=imperial&product=ck-senior-care');
  assert.ok(senior.body.grams > 60 && senior.body.grams < 80, `got ${senior.body.grams}`);
});

test('PS-418: per-kg products with sloppy units give a sane cat portion', () => {
  const res = handlePortion('species=cat&weight=3.8&product=ck-ocean-fish-dry');
  assert.equal(res.status, 200);
  assert.equal(res.body.grams, 55);
  const salmon = handlePortion('species=cat&weight=3.9&product=ck-salmon-soft-bites');
  assert.equal(salmon.body.grams, 61);
});
