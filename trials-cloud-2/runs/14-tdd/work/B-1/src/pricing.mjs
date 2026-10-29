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
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
};
const MASS_UNIT_RE = Object.keys(MASS_UNITS).join('|');
const LB_RE = 'lb|lbs|pound|pounds';
const OZ_RE = 'oz|ounce|ounces';
const COUNT_RE = '(\\d+)';
const INT_RE = /^\d+$/;

function parseCount(text, orig) {
  if (!INT_RE.test(text)) fail(orig);
  const n = Number(text);
  if (!(n > 0)) fail(orig);
  return n;
}

export function toGrams(spec) {
  if (typeof spec !== 'string') fail(spec);
  let s = trim(spec);
  let count = 1;
  const lead = s.match(new RegExp(`^${COUNT_RE}${SP}*[\u00D7xX]${SP}*(.+)$`));
  const tail = s.match(new RegExp(`^(.+?)${SP}*\\(${SP}*${COUNT_RE}${SP}+[^\\s()]+${SP}*\\)$`));
  if (lead) {
    count = parseCount(lead[1], spec);
    s = lead[2];
  } else if (tail) {
    count = parseCount(tail[2], spec);
    s = tail[1];
  }
  let grams;
  const compound = s.match(new RegExp(`^${NUM}${SP}*(${LB_RE})${SP}+${NUM}${SP}*(${OZ_RE})$`, 'i'));
  const single = s.match(new RegExp(`^${NUM}${SP}*(${MASS_UNIT_RE})$`, 'i'));
  if (compound) {
    grams = num(compound[1], spec) * MASS_UNITS.lb + num(compound[3], spec) * MASS_UNITS.oz;
  } else if (single) {
    grams = num(single[1], spec) * MASS_UNITS[single[2].toLowerCase()];
  } else {
    fail(spec);
  }
  grams *= count;
  if (!Number.isFinite(grams) || !(grams > 0)) fail(spec);
  return grams;
}

const SYMBOLS = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };
const ISO_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH'];
const MARKER_RE = new RegExp(`[$€£¥₴]|(?<![A-Za-z])(?:${ISO_CODES.join('|')})(?![A-Za-z])`, 'gi');
const SP_G = new RegExp(SP, 'g');

function parseAmount(text, orig) {
  let t = text.replace(/([.,])[-–—]$/, '$100');
  if (/[-−–—]/.test(t)) fail(orig);
  t = t.replace(SP_G, '');
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) fail(orig);
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let normalized;
  if (hasComma && hasDot) {
    const decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    t = t.split(group).join('');
    if (t.split(decimal).length !== 2) fail(orig);
    normalized = t.replace(decimal, '.');
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = t.split(sep);
    const isGroup = parts.length > 2 || /^\d{3}$/.test(parts[1]);
    normalized = isGroup ? parts.join('') : parts.join('.');
  } else {
    normalized = t;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) fail(orig);
  return n;
}

function parsePrice(priceText) {
  if (typeof priceText !== 'string') fail(priceText);
  let s = trim(priceText);
  let per = null;
  const unit = s.match(new RegExp(`^(.*?)${SP}*(?:/|per)${SP}*(kg|lb)$`, 'i'));
  if (unit) {
    per = unit[2].toLowerCase();
    s = unit[1];
  }
  const markers = [...s.matchAll(MARKER_RE)];
  if (markers.length !== 1) fail(priceText);
  const [m] = markers;
  const token = m[0];
  if (m.index !== 0 && m.index + token.length !== s.length) fail(priceText);
  const currency = SYMBOLS[token] ?? token.toUpperCase();
  const amount = parseAmount(trim(s.slice(0, m.index) + s.slice(m.index + token.length)), priceText);
  return { currency, amount, per };
}

export function pricePerKg(priceText, massSpec) {
  const { currency, amount, per } = parsePrice(priceText);
  const grams = toGrams(massSpec);
  let perKg;
  if (per === 'kg') perKg = amount;
  else if (per === 'lb') perKg = amount / 0.45359237;
  else perKg = amount / (grams / 1000);
  return { currency, perKg };
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
