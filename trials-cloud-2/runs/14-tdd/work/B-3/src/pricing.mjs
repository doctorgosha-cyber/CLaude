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
  let s = spec.trim();
  let count = 1;
  const lead = s.match(new RegExp(`^(\\d+)${SP}*[x\u00D7]${SP}*(.*)$`, 'i'));
  const trail = s.match(new RegExp(`^(.*?)${SP}*\\((\\d+)${SP}+[a-z]+\\)$`, 'i'));
  if (lead) {
    count = Number(lead[1]);
    s = lead[2];
  } else if (trail) {
    count = Number(trail[2]);
    s = trail[1];
  }
  if (!(count > 0)) throw bad(spec);
  const m = s.match(new RegExp(`^(${NUM})${SP}*([a-z]+)(?:${SP}+(${NUM})${SP}*([a-z]+))?$`, 'i'));
  if (!m) throw bad(spec);
  const f = unitFactor(m[2]);
  if (f === null) throw bad(spec);
  let g = num(m[1]) * f;
  if (m[3] !== undefined) {
    if (f !== LB || !/^(?:oz|ounces?)$/i.test(m[4])) throw bad(spec);
    g += num(m[3]) * OZ;
  }
  g *= count;
  if (!(g > 0) || !Number.isFinite(g)) throw bad(spec);
  return g;
}

const SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };
const CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH'];
const MARKER = `(?:[$€£¥₴]|${CODES.join('|')})`;

function parseAmount(text, orig) {
  if (!new RegExp(`^${NUM}$`).test(text)) throw bad(orig);
  const v = num(text);
  if (!(v > 0) || !Number.isFinite(v)) throw bad(orig);
  return v;
}

export function pricePerKg(priceText, massSpec) {
  if (typeof priceText !== 'string') throw bad(priceText);
  const grams = toGrams(massSpec);
  const s = priceText.trim();
  if (s.includes('-')) throw bad(priceText);
  const m = s.match(new RegExp(`^(?:(${MARKER})${SP}*(.+?)|(.+?)${SP}*(${MARKER}))$`, 'i'));
  if (!m) throw bad(priceText);
  const marker = (m[1] ?? m[4]).toUpperCase();
  const currency = SYMBOLS[marker] ?? marker;
  const body = m[2] ?? m[3];
  const amount = parseAmount(body, priceText);
  return { currency, perKg: amount / (grams / 1000) };
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
