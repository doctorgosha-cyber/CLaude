import test from 'node:test';
import assert from 'node:assert/strict';
import { handlePortion } from '../src/api.mjs';

test('portion for a 4.2 kg adult cat on Chicken & Rice is plausible; unknown product is a 404', () => {
  const res = handlePortion('species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.equal(res.status, 200);
  assert.ok(res.body.grams > 50 && res.body.grams < 85, `grams ${res.body.grams}`);
  assert.equal(res.body.product.id, 'ck-chicken-dry');
  assert.equal(handlePortion({ species: 'dog', weight: 20, product: 'nope' }).status, 404);
});

test('spec section 9 example: 4.2 kg adult cat on Chicken & Rice', () => {
  const res = handlePortion('species=cat&weight=4.2&stage=adult&activity=normal&product=ck-chicken-dry');
  assert.deepEqual(res.body, {
    grams: 66, kcalPerDay: 246.4, weight: 4.2, units: 'metric', capped: false, meals: 2, perMeal: 33,
    product: { id: 'ck-chicken-dry', name: 'Chicken & Rice Dry', kcalPer100g: 372 },
  });
});

test('PS-418: the four reported accounts now get the spec portion', () => {
  // u_1536: "kcal/kg " product was read as per 100 g -> 20 g
  let r = handlePortion('species=cat&weight=3.8&stage=adult&activity=normal&product=ck-ocean-fish-dry');
  assert.equal(r.status, 200);
  assert.equal(r.body.grams, 55);
  assert.equal(r.body.product.kcalPer100g, 412);
  // u_0874: imperial weight taken as kg and neutered_adult alias ignored -> 130 g
  r = handlePortion('species=cat&weight=11.5&stage=neutered_adult&activity=low&units=imperial&product=ck-senior-care');
  assert.equal(r.body.grams, 60);
  assert.equal(r.body.kcalPerDay, 205.4);
  assert.equal(r.body.weight, 11.5);
  assert.equal(r.body.units, 'imperial');
  // u_2291: imperial weight taken as kg -> 125 g
  r = handlePortion('species=cat&weight=10&stage=adult&activity=normal&units=imperial&product=ck-chicken-dry');
  assert.equal(r.body.grams, 70);
  // u_3078: scoop rounding -> 375 g; spec is whole grams
  r = handlePortion('species=dog&weight=24&stage=adult&activity=normal&product=dg-senior-light');
  assert.equal(r.body.grams, 377);
  assert.equal(r.body.perMeal, 189);
  assert.equal(r.body.capped, false);
});

test('imperial weight is converted at 1 lb = 0.45359 kg and only the echo keeps pounds', () => {
  const metric = handlePortion('species=dog&weight=10&stage=adult&product=dg-beef-dry');
  const imperial = handlePortion('species=dog&weight=22.0462&stage=adult&units=imperial&product=dg-beef-dry');
  assert.equal(imperial.body.grams, metric.body.grams);
  assert.equal(imperial.body.kcalPerDay, metric.body.kcalPerDay);
  assert.equal(imperial.body.weight, 22.0462);
});

test('stage: current keys and legacy aliases are accepted, anything else is a 400', () => {
  assert.equal(handlePortion('species=cat&weight=4&stage=neutered_adult&product=ck-chicken-dry').status, 200);
  assert.equal(handlePortion('species=cat&weight=4&stage=growth&product=ck-chicken-dry').body.meals, 3);
  const bad = handlePortion('species=cat&weight=4&stage=teen&product=ck-chicken-dry');
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /stage/);
  assert.equal(handlePortion('species=cat&weight=4&stage=puppy&product=ck-chicken-dry').status, 400);
  assert.equal(handlePortion('species=cat&weight=4&activity=sprint&product=ck-chicken-dry').status, 400);
});

test('safety cap: dry food is capped at 2.5 % (cat) / 3 % (dog) of body weight, not for growth or wet', () => {
  const cat = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-indoor-light');
  assert.equal(cat.body.capped, true);
  assert.equal(cat.body.grams, 50);
  assert.equal(cat.body.perMeal, 25);
  const dog = handlePortion('species=dog&weight=3&stage=adult&activity=high&product=dg-senior-light');
  assert.equal(dog.body.capped, true);
  assert.equal(dog.body.grams, 90);
  const kitten = handlePortion('species=cat&weight=2&stage=kitten&activity=high&product=ck-kitten-growth');
  assert.equal(kitten.body.capped, false);
  assert.ok(kitten.body.grams > 50);
  const wet = handlePortion('species=cat&weight=2&stage=adult&activity=high&product=ck-chicken-pate-wet');
  assert.equal(wet.body.capped, false);
  assert.ok(wet.body.grams > 50);
});

test('wet food: cans = grams / pack_g to one decimal; per-can energy is normalised', () => {
  const r = handlePortion('species=dog&weight=21&stage=adult&activity=normal&product=dg-beef-stew-wet');
  assert.equal(r.body.product.kcalPer100g, 97.5);
  assert.equal(r.body.grams, 1127); // 1098.7 kcal / 97.5 * 100
  assert.equal(r.body.cans, 2.8);
  const dry = handlePortion('species=dog&weight=21&stage=adult&product=dg-beef-dry');
  assert.equal('cans' in dry.body, false);
});
