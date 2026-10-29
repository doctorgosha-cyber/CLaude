// src/pricing.mjs — see README.md for the spec.

const SP = '[ \\u00A0\\u202F\\u2009]';
const NUM = '\\d+(?:[.,]\\d+)?|[.,]\\d+';

function bad(input) {
  return new TypeError(`invalid input: ${String(input)}`);
}

function num(text) {
  return Number(text.replace(',', '.'));
}

const OZ = 28.349523125;
const LB = 453.59237;
const MASS_UNITS = [
  [/^(?:g|grams?)$/i, 1],
  [/^(?:kg|kilograms?)$/i, 1000],
  [/^(?:oz|ounces?)$/i, OZ],
  [/^(?:lbs?|pounds?)$/i, LB],
];

function unitFactor(word) {
  for (const [re, f] of MASS_UNITS) if (re.test(word)) return f;
  return null;
}

export function toGrams(spec) {
  if (typeof spec !== 'string') throw bad(spec);
  const s = spec.trim();
  const m = s.match(new RegExp(`^(${NUM})${SP}*([a-z]+)(?:${SP}+(${NUM})${SP}*([a-z]+))?$`, 'i'));
  if (!m) throw bad(spec);
  const f = unitFactor(m[2]);
  if (f === null) throw bad(spec);
  let g = num(m[1]) * f;
  if (m[3] !== undefined) {
    if (f !== LB || !/^(?:oz|ounces?)$/i.test(m[4])) throw bad(spec);
    g += num(m[3]) * OZ;
  }
  if (!(g > 0) || !Number.isFinite(g)) throw bad(spec);
  return g;
}

export function pricePerKg(priceText, massSpec) {
  throw new Error('not implemented');
}

export function formatMoney(amount, currency, locale) {
  throw new Error('not implemented');
}

export function kcalPer100g(spec) {
  throw new Error('not implemented');
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  throw new Error('not implemented');
}

export function compare(products) {
  throw new Error('not implemented');
}
