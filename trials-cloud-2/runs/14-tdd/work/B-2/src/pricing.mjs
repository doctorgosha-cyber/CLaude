// src/pricing.mjs — see README.md for the spec.

const SP = '[\\u0020\\u00A0\\u202F\\u2009]';
const SPS = `${SP}*`;
const NUM = '(\\d+(?:[.,]\\d+)?|[.,]\\d+)';

function fail(input) {
  throw new TypeError(`invalid input: ${String(input)}`);
}

function num(s) {
  return Number(s.replace(',', '.'));
}

const UNIT_G = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
};

const MASS_RE = new RegExp(`^${NUM}${SPS}([a-z]+)$`, 'i');

export function toGrams(spec) {
  if (typeof spec !== 'string') fail(spec);
  const s = spec.trim();
  const m = MASS_RE.exec(s);
  if (!m) fail(spec);
  const factor = UNIT_G[m[2].toLowerCase()];
  if (factor === undefined) fail(spec);
  const g = num(m[1]) * factor;
  if (!(g > 0) || !Number.isFinite(g)) fail(spec);
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
