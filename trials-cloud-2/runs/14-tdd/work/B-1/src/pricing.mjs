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

const MINOR_UNITS = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, UAH: 2 };
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'uk-UA'];

// Round half to even on the decimal digits of String(amount); returns an exact
// decimal string with `places` fraction digits.
function roundDecimal(amount, places) {
  const [mant, expStr] = String(amount).toLowerCase().split('e');
  const [intPart, frac = ''] = mant.split('.');
  let digits = intPart + frac;
  const exp = (expStr ? Number(expStr) : 0) - frac.length; // value = digits * 10^exp
  let n;
  if (-exp <= places) {
    n = BigInt(digits + '0'.repeat(places + exp));
  } else {
    const keep = digits.length - (-exp - places);
    const kept = keep > 0 ? digits.slice(0, keep) : '';
    const rest = keep > 0 ? digits.slice(keep) : '0'.repeat(-keep) + digits;
    n = BigInt(kept || '0');
    const first = rest[0];
    const tailZero = /^0*$/.test(rest.slice(1));
    const roundUp = first > '5' || (first === '5' && (!tailZero || n % 2n === 1n));
    if (roundUp) n += 1n;
  }
  const str = n.toString().padStart(places + 1, '0');
  return places === 0 ? str : `${str.slice(0, -places)}.${str.slice(-places)}`;
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) fail(amount);
  if (typeof currency !== 'string' || !(currency in MINOR_UNITS)) fail(currency);
  if (typeof locale !== 'string' || !LOCALES.includes(locale)) fail(locale);
  const minor = MINOR_UNITS[currency];
  const rounded = roundDecimal(amount, minor);
  const out = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: minor,
    maximumFractionDigits: minor,
  }).format(rounded);
  return out.replace(/ /g, ' ');
}

const KJ_PER_KCAL = 4.184;

export function kcalPer100g(spec) {
  if (typeof spec !== 'string') fail(spec);
  const s = trim(spec);
  const m = s.match(new RegExp(`^${NUM}${SP}*(kcal|kj)${SP}*(?:/|per)${SP}*(100${SP}*g|kg)$`, 'i'));
  if (!m) fail(spec);
  let value = num(m[1], spec);
  if (m[2].toLowerCase() === 'kj') value /= KJ_PER_KCAL;
  if (m[3].toLowerCase() === 'kg') value /= 10;
  if (!(value >= 50 && value <= 900)) fail(spec);
  return value;
}

function massArg(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) fail(value);
    return value;
  }
  return toGrams(value);
}

function parseISODate(startISO) {
  if (typeof startISO !== 'string') fail(startISO);
  const m = startISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) fail(startISO);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const dt = new Date(utc);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) fail(startISO);
  return utc;
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  const bag = massArg(bagGrams);
  const daily = massArg(dailyGrams);
  const start = parseISODate(startISO);
  const days = Math.floor(bag / daily);
  if (!Number.isFinite(days) || days < 1) fail(`${String(bagGrams)} / ${String(dailyGrams)}`);
  const last = new Date(start + (days - 1) * 86400000);
  const pad = (n, w) => String(n).padStart(w, '0');
  return `${pad(last.getUTCFullYear(), 4)}-${pad(last.getUTCMonth() + 1, 2)}-${pad(last.getUTCDate(), 2)}`;
}

export function compare(products) {
  throw new Error('not implemented');
}
