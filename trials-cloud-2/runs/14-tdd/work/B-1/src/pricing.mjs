// src/pricing.mjs — see README.md for the spec.

const SP = '[\\u0020\\u00A0\\u202F\\u2009]';
const NUM = '(\\d+(?:[.,]\\d+)?|[.,]\\d+)';

function fail(input) {
  throw new TypeError(`invalid input: ${String(input)}`);
}

function trim(s) {
  return s.replace(new RegExp(`^${SP}+|${SP}+$`, 'g'), '');
}

function num(text, orig) {
  const n = Number(text.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) fail(orig);
  return n;
}

const MASS_UNITS = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
};

export function toGrams(spec) {
  if (typeof spec !== 'string') fail(spec);
  const s = trim(spec);
  const unit = Object.keys(MASS_UNITS).join('|');
  const m = s.match(new RegExp(`^${NUM}${SP}*(${unit})$`, 'i'));
  if (!m) fail(spec);
  const grams = num(m[1], spec) * MASS_UNITS[m[2].toLowerCase()];
  if (!(grams > 0)) fail(spec);
  return grams;
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
