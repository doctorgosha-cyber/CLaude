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

const LEAD_PACK_RE = new RegExp(`^(\\d+)${SPS}[\u00D7xX]${SPS}(.+)$`);
const TRAIL_PACK_RE = new RegExp(`^(.+?)${SPS}\\((\\d+)${SP}+[a-z]+\\)$`, 'i');

export function toGrams(spec) {
  if (typeof spec !== 'string') fail(spec);
  let s = spec.trim();
  let count = 1;
  let m;
  if ((m = LEAD_PACK_RE.exec(s))) {
    count = Number(m[1]);
    s = m[2].trim();
  } else if ((m = TRAIL_PACK_RE.exec(s))) {
    count = Number(m[2]);
    s = m[1].trim();
  }
  const g = count * simpleMass(s, spec);
  if (!(g > 0) || !Number.isFinite(g)) fail(spec);
  return g;
}

const SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };
const CODES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH']);
const MARKER_RE = /[$€£¥₴]|\b[A-Za-z]{3}\b/g;

const UNIT_PRICE_RE = new RegExp(`^(.*?)${SPS}(?:/|per)${SPS}(kg|lb)$`, 'i');

// Returns { currency, amount, per } (per: null | 'kg' | 'lb') or throws TypeError.
function parsePrice(priceText) {
  if (typeof priceText !== 'string') fail(priceText);
  let s = priceText.trim();
  let per = null;
  const u = UNIT_PRICE_RE.exec(s);
  if (u) {
    per = u[2].toLowerCase();
    s = u[1].trim();
  }
  const markers = [...s.matchAll(MARKER_RE)];
  if (markers.length !== 1) fail(priceText);
  const tok = markers[0][0];
  const currency = SYMBOLS[tok] ?? (CODES.has(tok.toUpperCase()) ? tok.toUpperCase() : undefined);
  if (!currency) fail(priceText);
  const rest = (s.slice(0, markers[0].index) + s.slice(markers[0].index + tok.length)).trim();
  const amount = parseAmount(rest, priceText);
  if (!(amount > 0) || !Number.isFinite(amount)) fail(priceText);
  return { currency, amount, per };
}

const SPACE_RE = new RegExp(SP, 'g');
const AMOUNT_RE = /^\d+(?:[.,]\d+)*(?:[.,](?:\d+|[-\u2013\u2014]))?$/;

function parseAmount(text, orig) {
  const t = text.replace(SPACE_RE, '');
  if (!AMOUNT_RE.test(t)) fail(orig);
  // Trailing dash after a separator: zero minor units.
  const dash = /^(.*)[.,][-\u2013\u2014]$/.exec(t);
  const body = dash ? dash[1] : t;
  const hasComma = body.includes(',');
  const hasDot = body.includes('.');
  let intPart = body;
  let frac = '';
  if (hasComma && hasDot) {
    const last = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'));
    const decimalSep = body[last];
    const groupSep = decimalSep === ',' ? '\\.' : ',';
    if (body.indexOf(decimalSep) !== last) fail(orig);
    intPart = body.slice(0, last);
    frac = body.slice(last + 1);
    if (!new RegExp(`^\\d+(?:${groupSep}\\d{3})*$`).test(intPart)) fail(orig);
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = body.split(sep);
    const grouping = parts.length > 2 || parts[parts.length - 1].length === 3;
    if (grouping) {
      if (!parts.slice(1).every((g) => g.length === 3)) fail(orig);
    } else {
      intPart = parts[0];
      frac = parts[1];
    }
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(frac)) fail(orig);
  return Number(frac ? `${intPart}.${frac}` : intPart);
}

export function pricePerKg(priceText, massSpec) {
  const { currency, amount, per } = parsePrice(priceText);
  const grams = toGrams(massSpec);
  if (per === 'kg') return { currency, perKg: amount };
  if (per === 'lb') return { currency, perKg: amount / 0.45359237 };
  return { currency, perKg: amount / (grams / 1000) };
}

const MINOR_UNITS = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, UAH: 2 };
const LOCALES = new Set(['en-US', 'de-DE', 'fr-FR', 'uk-UA']);

// Decimal digits of the shortest round-trip representation of x (x finite, >= 0),
// as { int, frac } digit strings, with any exponent expanded.
function decimalDigits(x) {
  const str = String(x);
  const m = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(str);
  if (!m) throw new TypeError(`invalid input: ${str}`);
  let digits = m[1] + (m[2] ?? '');
  let point = m[1].length + Number(m[3] ?? 0);
  if (point <= 0) {
    digits = '0'.repeat(1 - point) + digits;
    point = 1;
  } else if (point > digits.length) {
    digits += '0'.repeat(point - digits.length);
  }
  return { int: digits.slice(0, point), frac: digits.slice(point) };
}

// Round half to even to `places` fraction digits; returns a decimal string.
function roundHalfEven(x, places) {
  const { int, frac } = decimalDigits(x);
  const kept = (int + frac.slice(0, places).padEnd(places, '0'));
  const rest = frac.slice(places);
  const firstRest = rest[0] ?? '0';
  const tailNonZero = /[1-9]/.test(rest.slice(1));
  let up = false;
  if (firstRest > '5' || (firstRest === '5' && tailNonZero)) up = true;
  else if (firstRest === '5') up = Number(kept[kept.length - 1]) % 2 === 1;
  let digits = kept;
  if (up) {
    const arr = digits.split('');
    let i = arr.length - 1;
    while (i >= 0) {
      if (arr[i] === '9') { arr[i] = '0'; i--; }
      else { arr[i] = String(Number(arr[i]) + 1); break; }
    }
    digits = (i < 0 ? '1' : '') + arr.join('');
  }
  const intLen = digits.length - places;
  const intStr = digits.slice(0, intLen).replace(/^0+(?=\d)/, '');
  return places ? `${intStr}.${digits.slice(intLen)}` : intStr;
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) fail(amount);
  if (typeof currency !== 'string' || !(currency in MINOR_UNITS)) fail(currency);
  if (typeof locale !== 'string' || !LOCALES.has(locale)) fail(locale);
  const places = MINOR_UNITS[currency];
  const rounded = roundHalfEven(amount, places);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(rounded);
}

const KJ_PER_KCAL = 4.184;
const ENERGY_RE = new RegExp(`^${NUM}${SPS}(kcal|kj)${SPS}(?:/|per)${SPS}(100${SPS}g|kg)$`, 'i');

export function kcalPer100g(spec) {
  if (typeof spec !== 'string') fail(spec);
  const m = ENERGY_RE.exec(spec.trim());
  if (!m) fail(spec);
  let value = num(m[1]);
  if (m[2].toLowerCase() === 'kj') value /= KJ_PER_KCAL;
  if (m[3].toLowerCase() === 'kg') value /= 10;
  if (!Number.isFinite(value) || value < 50 || value > 900) fail(spec);
  return value;
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  throw new Error('not implemented');
}

export function compare(products) {
  throw new Error('not implemented');
}
