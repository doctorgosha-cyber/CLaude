// Hidden test cases for src/pricing.mjs — 25 cases, score = passed / 25.
// Each case: { id, name, run(mod) } ; run throws on failure.
// Expected values and rationale are given inline (see also ../KEY.md).

import assert from 'node:assert/strict';

const OZ = 28.349523125;      // exact, by definition of the international avoirdupois ounce
const LB = 453.59237;         // exact
const NBSP = ' ';
const NNBSP = ' ';

function near(actual, expected, eps = 1e-6, msg = '') {
  if (typeof actual !== 'number' || !(Math.abs(actual - expected) <= eps)) {
    throw new assert.AssertionError({ message: `${msg} expected ${expected} ±${eps}, got ${String(actual)}`, actual, expected });
  }
}

function throwsType(fn, mustInclude, label) {
  let err;
  try { fn(); } catch (e) { err = e; }
  if (!err) throw new assert.AssertionError({ message: `${label}: expected a TypeError, nothing thrown` });
  if (!(err instanceof TypeError)) throw new assert.AssertionError({ message: `${label}: expected TypeError, got ${err && err.constructor && err.constructor.name}: ${err && err.message}` });
  if (typeof err.message !== 'string' || err.message.length === 0) throw new assert.AssertionError({ message: `${label}: TypeError message is empty` });
  if (mustInclude !== undefined && !err.message.includes(mustInclude)) throw new assert.AssertionError({ message: `${label}: message ${JSON.stringify(err.message)} does not include ${JSON.stringify(mustInclude)}` });
}

function show(s) { return JSON.stringify(s).replace(/ /g, '<NBSP>').replace(/ /g, '<NNBSP>'); }
function eqStr(actual, expected, label) {
  if (actual !== expected) throw new assert.AssertionError({ message: `${label}: expected ${show(expected)}, got ${show(actual)}` });
}

export const cases = [
  // ---------------------------------------------------------------- toGrams
  { id: 'T01', name: 'toGrams: plain units g/kg/oz/lb, case-insensitive, no-space form', run: (m) => {
    near(m.toGrams('1.2 kg'), 1200);
    near(m.toGrams('500g'), 500);
    near(m.toGrams('40 oz'), 40 * OZ);          // 1133.98093
    near(m.toGrams('2 lb'), 2 * LB);            // 907.18474
    near(m.toGrams('1.2 KG'), 1200);
    near(m.toGrams('3 Pounds'), 3 * LB);
  } },
  { id: 'T02', name: 'toGrams: compound "1 lb 4 oz"', run: (m) => {
    near(m.toGrams('1 lb 4 oz'), LB + 4 * OZ);  // 566.9904625
    near(m.toGrams('1lb 4oz'), LB + 4 * OZ);
    near(m.toGrams('2 lbs 8 oz'), 2 * LB + 8 * OZ);
  } },
  { id: 'T03', name: 'toGrams: multipack prefix with × (U+00D7) and x/X', run: (m) => {
    near(m.toGrams('2 × 400 g'), 800);
    near(m.toGrams('3x350g'), 1050);
    near(m.toGrams('2 X 400 g'), 800);
    near(m.toGrams('4 × 0.5 kg'), 2000);
    near(m.toGrams('2 × 1 lb 4 oz'), 2 * (LB + 4 * OZ));   // count applies to a compound mass too
  } },
  { id: 'T04', name: 'toGrams: trailing parenthetical pack count "(2 bags)"', run: (m) => {
    near(m.toGrams('0.75 kg (2 bags)'), 1500);
    near(m.toGrams('400 g (12 pouches)'), 4800);
    near(m.toGrams('85 g (24 cans)'), 2040);
    near(m.toGrams('1 lb 4 oz (2 bags)'), 2 * (LB + 4 * OZ));
  } },
  { id: 'T05', name: 'toGrams: decimal comma, NBSP/NNBSP between number and unit, surrounding whitespace', run: (m) => {
    near(m.toGrams('1,5 kg'), 1500);
    near(m.toGrams('1.2 kg'), 1200);
    near(m.toGrams('750 g'), 750);
    near(m.toGrams('  500 g  '), 500);
    near(m.toGrams('2 × 400 g'), 800);
  } },
  { id: 'T06', name: 'toGrams: zero/negative/garbage/non-string throw TypeError naming the input', run: (m) => {
    throwsType(() => m.toGrams('0 g'), '0 g', 'zero');
    throwsType(() => m.toGrams('-2 kg'), '-2 kg', 'negative');
    throwsType(() => m.toGrams('two kg'), 'two kg', 'word number');
    throwsType(() => m.toGrams('500'), '500', 'missing unit');
    throwsType(() => m.toGrams('500 ml'), '500 ml', 'wrong unit');
    throwsType(() => m.toGrams(''), undefined, 'empty');
    throwsType(() => m.toGrams(null), undefined, 'null');
    throwsType(() => m.toGrams(500), undefined, 'number');
  } },

  // ------------------------------------------------------------- pricePerKg
  { id: 'P01', name: 'pricePerKg: "$29.99"/400 g and code-after "12.5 USD"', run: (m) => {
    const r = m.pricePerKg('$29.99', '400 g');
    assert.equal(r.currency, 'USD'); near(r.perKg, 74.975, 1e-9);
    const r2 = m.pricePerKg('12.5 USD', '250g');
    assert.equal(r2.currency, 'USD'); near(r2.perKg, 50, 1e-9);
    const r3 = m.pricePerKg('5 usd', '1 kg');
    assert.equal(r3.currency, 'USD'); near(r3.perKg, 5, 1e-9);
    const r4 = m.pricePerKg('USD 12.50', '500 g');                // code before the number
    assert.equal(r4.currency, 'USD'); near(r4.perKg, 25, 1e-9);
  } },
  { id: 'P02', name: 'pricePerKg: decimal comma and € after the number', run: (m) => {
    const r = m.pricePerKg('29,99 €', '1,5 kg');
    assert.equal(r.currency, 'EUR'); near(r.perKg, 29.99 / 1.5, 1e-9);   // 19.99333...
    const r2 = m.pricePerKg('4,50€', '500 g');
    assert.equal(r2.currency, 'EUR'); near(r2.perKg, 9, 1e-9);
  } },
  { id: 'P03', name: 'pricePerKg: thousands separators in both conventions', run: (m) => {
    const r = m.pricePerKg('£1,299.00', '20 kg');
    assert.equal(r.currency, 'GBP'); near(r.perKg, 64.95, 1e-9);
    const r2 = m.pricePerKg('1.299,00 €', '2 × 5 kg');
    assert.equal(r2.currency, 'EUR'); near(r2.perKg, 129.9, 1e-9);
    const r3 = m.pricePerKg('¥1,200', '1 kg');                  // lone separator + 3 digits = thousands
    assert.equal(r3.currency, 'JPY'); near(r3.perKg, 1200, 1e-9);
    const r4 = m.pricePerKg('€1.299', '1 kg');
    assert.equal(r4.currency, 'EUR'); near(r4.perKg, 1299, 1e-9);
    const r5 = m.pricePerKg('$12,345,678.90', '1 kg');
    assert.equal(r5.currency, 'USD'); near(r5.perKg, 12345678.9, 1e-6);
  } },
  { id: 'P04', name: 'pricePerKg: Swiss "CHF 12.–" dash means .00', run: (m) => {
    const r = m.pricePerKg('CHF 12.–', '500 g');
    assert.equal(r.currency, 'CHF'); near(r.perKg, 24, 1e-9);
    const r2 = m.pricePerKg('CHF 12.-', '500 g');
    assert.equal(r2.currency, 'CHF'); near(r2.perKg, 24, 1e-9);
    const r3 = m.pricePerKg('1.250,— CHF', '1 kg');
    assert.equal(r3.currency, 'CHF'); near(r3.perKg, 1250, 1e-9);
  } },
  { id: 'P05', name: 'pricePerKg: € before with space, NBSP and NNBSP group separators, bare integer', run: (m) => {
    const r = m.pricePerKg('€ 1 299,00', '10 kg');
    assert.equal(r.currency, 'EUR'); near(r.perKg, 129.9, 1e-9);
    const r2 = m.pricePerKg('1 299,00 €', '10 kg');
    assert.equal(r2.currency, 'EUR'); near(r2.perKg, 129.9, 1e-9);
    const r3 = m.pricePerKg('€1299', '10 kg');
    assert.equal(r3.currency, 'EUR'); near(r3.perKg, 129.9, 1e-9);
    const r4 = m.pricePerKg('₴ 1 234,50', '1 kg');
    assert.equal(r4.currency, 'UAH'); near(r4.perKg, 1234.5, 1e-9);
  } },
  { id: 'P06', name: 'pricePerKg: negative, zero, no currency, two currencies, zero mass → TypeError', run: (m) => {
    throwsType(() => m.pricePerKg('-$5.00', '1 kg'), undefined, 'minus before symbol');
    throwsType(() => m.pricePerKg('$-5.00', '1 kg'), undefined, 'minus after symbol');
    throwsType(() => m.pricePerKg('$0.00', '1 kg'), '$0.00', 'zero price');
    throwsType(() => m.pricePerKg('5.00', '1 kg'), '5.00', 'no currency');
    throwsType(() => m.pricePerKg('$5.00 USD', '1 kg'), undefined, 'two markers');
    throwsType(() => m.pricePerKg('5.00 PLN', '1 kg'), undefined, 'unknown code');
    throwsType(() => m.pricePerKg('$5.00', '0 g'), '0 g', 'zero mass');
  } },

  // ------------------------------------------------------------ formatMoney
  { id: 'F01', name: 'formatMoney: round half to even on decimal digits (en-US USD)', run: (m) => {
    // Rationale: 2.125, 2.625, 2.875 are exact binary halves — every rounding method agrees on the
    // input, only the tie rule differs: half-even → 2.12, 2.62, 2.88; toFixed/Math.round/Intl default → 2.13, 2.63, 2.88.
    // 2.345 and 2.355: String() prints "2.345"/"2.355" → half-even → 2.34 / 2.36. toFixed gives 2.35/2.35 (binary value).
    eqStr(m.formatMoney(2.125, 'USD', 'en-US'), '$2.12', '2.125');
    eqStr(m.formatMoney(2.625, 'USD', 'en-US'), '$2.62', '2.625');
    eqStr(m.formatMoney(2.875, 'USD', 'en-US'), '$2.88', '2.875');
    eqStr(m.formatMoney(2.345, 'USD', 'en-US'), '$2.34', '2.345');
    eqStr(m.formatMoney(2.355, 'USD', 'en-US'), '$2.36', '2.355');
    eqStr(m.formatMoney(1.005, 'USD', 'en-US'), '$1.00', '1.005');
    eqStr(m.formatMoney(0.125, 'USD', 'en-US'), '$0.12', '0.125');
    eqStr(m.formatMoney(2.1251, 'USD', 'en-US'), '$2.13', '2.1251 (above half)');
    // 1.015*100 === 101.49999999999999 in binary: numeric half-even gives 1.01; the decimal-digit rule gives 1.02
    eqStr(m.formatMoney(1.015, 'USD', 'en-US'), '$1.02', '1.015');
    eqStr(m.formatMoney(0.005, 'USD', 'en-US'), '$0.00', '0.005');
  } },
  { id: 'F02', name: 'formatMoney: JPY has 0 minor units; en-US grouping; negative/NaN/non-number/unknown currency → TypeError', run: (m) => {
    eqStr(m.formatMoney(2.5, 'JPY', 'en-US'), '¥2', '2.5 JPY');
    eqStr(m.formatMoney(3.5, 'JPY', 'en-US'), '¥4', '3.5 JPY');
    eqStr(m.formatMoney(1234.5, 'JPY', 'en-US'), '¥1,234', '1234.5 JPY');
    eqStr(m.formatMoney(1234.56, 'USD', 'en-US'), '$1,234.56', 'USD grouping');
    eqStr(m.formatMoney(1234567.891, 'GBP', 'en-US'), '£1,234,567.89', 'GBP grouping');
    eqStr(m.formatMoney(0, 'EUR', 'en-US'), '€0.00', 'zero');
    eqStr(m.formatMoney(1234.5, 'CHF', 'en-US'), 'CHF' + NBSP + '1,234.50', 'CHF code + NBSP');
    eqStr(m.formatMoney(0.5, 'JPY', 'en-US'), '¥0', '0.5 JPY');
    throwsType(() => m.formatMoney(-1, 'USD', 'en-US'), '-1', 'negative');
    throwsType(() => m.formatMoney(NaN, 'USD', 'en-US'), undefined, 'NaN');
    throwsType(() => m.formatMoney('1.00', 'USD', 'en-US'), undefined, 'string amount');
    throwsType(() => m.formatMoney(1, 'PLN', 'en-US'), 'PLN', 'unknown currency');
  } },
  { id: 'F03', name: 'formatMoney: de-DE layout "1.234,50 €" with NBSP, half-even applies', run: (m) => {
    eqStr(m.formatMoney(1234.5, 'EUR', 'de-DE'), '1.234,50' + NBSP + '€', 'EUR');
    eqStr(m.formatMoney(2.125, 'USD', 'de-DE'), '2,12' + NBSP + '$', 'USD half-even');
    eqStr(m.formatMoney(1234.5, 'JPY', 'de-DE'), '1.234' + NBSP + '¥', 'JPY');
    eqStr(m.formatMoney(1234.5, 'CHF', 'de-DE'), '1.234,50' + NBSP + 'CHF', 'CHF');
  } },
  { id: 'F04', name: 'formatMoney: fr-FR uses U+202F for groups and U+00A0 before the symbol', run: (m) => {
    eqStr(m.formatMoney(1234.5, 'EUR', 'fr-FR'), '1' + NNBSP + '234,50' + NBSP + '€', 'EUR');
    eqStr(m.formatMoney(1234.5, 'USD', 'fr-FR'), '1' + NNBSP + '234,50' + NBSP + '$', 'USD narrow symbol');
    eqStr(m.formatMoney(1234567.125, 'EUR', 'fr-FR'), '1' + NNBSP + '234' + NNBSP + '567,12' + NBSP + '€', 'two groups + half-even');
  } },
  { id: 'F05', name: 'formatMoney: uk-UA uses U+00A0 for groups and before ₴/€', run: (m) => {
    eqStr(m.formatMoney(1234.5, 'UAH', 'uk-UA'), '1' + NBSP + '234,50' + NBSP + '₴', 'UAH');
    eqStr(m.formatMoney(1234.5, 'EUR', 'uk-UA'), '1' + NBSP + '234,50' + NBSP + '€', 'EUR narrow symbol');
    eqStr(m.formatMoney(2.5, 'JPY', 'uk-UA'), '2' + NBSP + '¥', 'JPY half-even');
    eqStr(m.formatMoney(99.995, 'UAH', 'uk-UA'), '100,00' + NBSP + '₴', 'carry');
  } },

  // ------------------------------------------------------------ kcalPer100g
  { id: 'K01', name: 'kcalPer100g: kcal/100 g, kcal/kg, kJ/100 g, kJ/kg, "per" wording', run: (m) => {
    near(m.kcalPer100g('350 kcal/100 g'), 350);
    near(m.kcalPer100g('3500 kcal/kg'), 350);
    near(m.kcalPer100g('1464 kJ/100 g'), 1464 / 4.184);       // 349.9043977...
    near(m.kcalPer100g('14640 kJ/kg'), 1464 / 4.184);
    near(m.kcalPer100g('350 kcal per 100g'), 350);
    near(m.kcalPer100g('3 600 KCAL / KG'.replace(' 600', '600')), 360);
    near(m.kcalPer100g('349,9 kcal/100 g'), 349.9);
  } },
  { id: 'K02', name: 'kcalPer100g: sanity range on the normalised value (kJ/kg trap)', run: (m) => {
    throwsType(() => m.kcalPer100g('20 kcal/100 g'), '20 kcal/100 g', 'too low');
    throwsType(() => m.kcalPer100g('4000 kcal/100 g'), undefined, 'too high');
    throwsType(() => m.kcalPer100g('1500 kJ/kg'), '1500 kJ/kg', '1500 kJ/kg = 35.85 kcal/100 g, below 50');
    throwsType(() => m.kcalPer100g('40000 kJ/kg'), undefined, '40000 kJ/kg = 956 kcal/100 g, above 900');
    near(m.kcalPer100g('50 kcal/100 g'), 50);     // inclusive bounds
    near(m.kcalPer100g('900 kcal/100 g'), 900);
    throwsType(() => m.kcalPer100g('350 cal/100 g'), undefined, 'unknown unit');
  } },

  // ------------------------------------------------------------- daysSupply
  { id: 'D01', name: 'daysSupply: leap day 2028-02-29 reached; 2100 is not a leap year', run: (m) => {
    assert.equal(m.daysSupply(3000, 1000, '2028-02-27'), '2028-02-29');   // 27, 28, 29
    assert.equal(m.daysSupply(2000, 1000, '2028-02-28'), '2028-02-29');
    assert.equal(m.daysSupply(2000, 1000, '2100-02-28'), '2100-03-01');   // no Feb 29 in 2100
    assert.equal(m.daysSupply(2000, 1000, '2000-02-28'), '2000-02-29');   // 2000 is a leap year
    assert.equal(m.daysSupply(36600, 100, '2027-03-01'), '2028-02-29');   // 366 days: Mar 1 2027 .. Feb 29 2028
    assert.equal(m.daysSupply(6100, 100, '2099-12-31'), '2100-03-01');    // 61 days across a non-leap century
  } },
  { id: 'D02', name: 'daysSupply: month/year end, whole-day floor, one-day bag', run: (m) => {
    assert.equal(m.daysSupply(2000, 300, '2027-12-27'), '2028-01-01');    // floor(6.67)=6: 27..31, Jan 1
    assert.equal(m.daysSupply(900, 300, '2026-01-30'), '2026-02-01');
    assert.equal(m.daysSupply(1000, 1000, '2026-10-29'), '2026-10-29');   // exactly one day
    assert.equal(m.daysSupply(1999, 1000, '2026-10-31'), '2026-10-31');   // 1.999 days → 1
    assert.equal(m.daysSupply(12000, 100, '2026-03-01'), '2026-06-28');   // 120 days
  } },
  { id: 'D03', name: 'daysSupply: invalid calendar date, non-strict format, sub-day bag, zero/negative → TypeError', run: (m) => {
    throwsType(() => m.daysSupply(2000, 1000, '2027-02-29'), '2027-02-29', 'not a leap year');
    throwsType(() => m.daysSupply(2000, 1000, '2028-02-27T00:00:00Z'), undefined, 'timestamp form');
    throwsType(() => m.daysSupply(2000, 1000, '2028-2-27'), undefined, 'unpadded');
    throwsType(() => m.daysSupply(500, 1000, '2028-02-27'), undefined, 'bag smaller than a day');
    throwsType(() => m.daysSupply(2000, 0, '2028-02-27'), undefined, 'zero daily');
    throwsType(() => m.daysSupply(-2000, 100, '2028-02-27'), undefined, 'negative bag');
    throwsType(() => m.daysSupply('2000', 100, '2028-02-27'), undefined, 'string bag');
  } },

  // ---------------------------------------------------------------- compare
  { id: 'C01', name: 'compare: sorted ascending by perKg across formats and currencies; ties keep input order', run: (m) => {
    const products = [
      { id: 'a', price: '$29.99', mass: '400 g' },        // 74.975
      { id: 'b', price: '29,99 €', mass: '2 × 1 kg' },    // 14.995
      { id: 'c', price: '£10.00', mass: '1 kg' },         // 10
      { id: 'd', price: '€5', mass: '500 g' },            // 10  (tie with c)
      { id: 'e', price: 'CHF 12.–', mass: '1 lb' },       // 26.455...
      { id: 'f', price: '₴20', mass: '2 kg' },            // 10  (tie with c, d)
      { id: 'g', price: '¥1,200', mass: '0.5 kg (2 bags)' }, // 1200
    ];
    const out = m.compare(products);
    assert.deepEqual(out.map((r) => r.id), ['c', 'd', 'f', 'b', 'e', 'a', 'g']);
    assert.deepEqual(out[0], { id: 'c', currency: 'GBP', perKg: 10 });
    assert.deepEqual(out[2], { id: 'f', currency: 'UAH', perKg: 10 });
    near(out[4].perKg, 12 / (LB / 1000), 1e-9); assert.equal(out[4].currency, 'CHF');
  } },
  { id: 'C02', name: 'compare: stable for many ties (same value computed differently)', run: (m) => {
    // every item is exactly 10 per kg; the sort must keep input order
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const products = [
      { id: 'p1', price: '$10', mass: '1 kg' },
      { id: 'p2', price: '$5', mass: '500 g' },
      { id: 'p3', price: '$20', mass: '2 × 1 kg' },
      { id: 'p4', price: '$2.50', mass: '250 g' },
      { id: 'p5', price: '$40.00', mass: '4 kg' },
      { id: 'p6', price: '€1', mass: '100 g' },
      { id: 'p7', price: '$10', mass: '1000 g' },
      { id: 'p8', price: '£80', mass: '8 kg' },
    ];
    const out = m.compare(products);
    assert.deepEqual(out.map((r) => r.id), ids);
    for (const r of out) near(r.perKg, 10, 1e-9, r.id);
    // repeated calls on a reversed copy keep the reversed order
    const rev = [...products].reverse();
    assert.deepEqual(m.compare(rev).map((r) => r.id), [...ids].reverse());
  } },
  { id: 'C03', name: 'compare: unparseable items last in input order with NaN/null; input not mutated; non-array → TypeError', run: (m) => {
    const products = [
      { id: 'bad1', price: '5.00', mass: '1 kg' },        // no currency
      { id: 'ok1', price: '$20', mass: '1 kg' },
      { id: 'bad2', price: '$5', mass: '0 g' },           // zero mass
      { id: 'ok2', price: '$10', mass: '1 kg' },
      { id: 'bad3', price: '$5', mass: 'two kg' },
      { id: 'bad4', price: undefined, mass: '1 kg' },  // missing price is invalid, not an error
      { id: 'bad5' },
    ];
    const snapshot = JSON.stringify(products);
    const out = m.compare(products);
    assert.deepEqual(out.map((r) => r.id), ['ok2', 'ok1', 'bad1', 'bad2', 'bad3', 'bad4', 'bad5']);
    for (const r of out.slice(2)) {
      assert.equal(r.currency, null, r.id + ' currency');
      assert.ok(Number.isNaN(r.perKg), r.id + ' perKg should be NaN');
    }
    assert.equal(JSON.stringify(products), snapshot, 'input mutated');
    assert.notEqual(out, products, 'must return a new array');
    throwsType(() => m.compare('nope'), undefined, 'non-array');
    throwsType(() => m.compare({ length: 1 }), undefined, 'array-like');
    assert.deepEqual(m.compare([]), []);
  } },
];
