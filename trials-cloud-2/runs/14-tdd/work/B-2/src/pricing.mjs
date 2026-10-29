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

const OZ = 28.349523125;
const LB = 453.59237;
const UNIT_G = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: OZ, ounce: OZ, ounces: OZ,
  lb: LB, lbs: LB, pound: LB, pounds: LB,
};

const MASS_RE = new RegExp(`^${NUM}${SPS}([a-z]+)$`, 'i');
const COMPOUND_RE = new RegExp(`^${NUM}${SPS}(lbs?|pounds?)${SP}+${NUM}${SPS}(oz|ounces?)$`, 'i');

function simpleMass(s, orig) {
  const c = COMPOUND_RE.exec(s);
  if (c) return num(c[1]) * LB + num(c[3]) * OZ;
  const m = MASS_RE.exec(s);
  if (!m) fail(orig);
  const factor = UNIT_G[m[2].toLowerCase()];
  if (factor === undefined) fail(orig);
  return num(m[1]) * factor;
}

export function toGrams(spec) {
  if (typeof spec !== 'string') fail(spec);
  const g = simpleMass(spec.trim(), spec);
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
