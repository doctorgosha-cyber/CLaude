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
  let t = text.replace(new RegExp(SP, 'g'), '');
  // "12.–", "12.-", "12,—": a dash after the decimal mark means zero minor units.
  const dash = t.match(/^(\d[\d.,]*)([.,])[-\u2013\u2014]$/);
  if (dash) t = `${dash[1]}${dash[2]}00`;
  if (!/^\d[\d.,]*\d$|^\d$/.test(t)) throw bad(orig);
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let intPart = t;
  let frac = '';
  if (hasComma && hasDot) {
    const dec = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    const parts = t.split(dec === ',' ? '.' : ',').join('').split(dec);
    if (parts.length !== 2) throw bad(orig);
    [intPart, frac] = parts;
  } else if (hasComma || hasDot) {
    const parts = t.split(hasComma ? ',' : '.');
    if (parts.some((p) => p === '')) throw bad(orig);
    if (parts.length > 2 || parts[1].length === 3) intPart = parts.join('');
    else [intPart, frac] = parts;
  }
  const v = Number(frac ? `${intPart}.${frac}` : intPart);
  if (!(v > 0) || !Number.isFinite(v)) throw bad(orig);
  return v;
}

export function pricePerKg(priceText, massSpec) {
  if (typeof priceText !== 'string') throw bad(priceText);
  const grams = toGrams(massSpec);
  let s = priceText.trim();
  let per = null;
  const unit = s.match(new RegExp(`^(.*?)${SP}*(?:/|per)${SP}*(kg|lb)$`, 'i'));
  if (unit) {
    per = unit[2].toLowerCase();
    s = unit[1];
  }
  const m = s.match(new RegExp(`^(?:(${MARKER})${SP}*(.+?)|(.+?)${SP}*(${MARKER}))$`, 'i'));
  if (!m) throw bad(priceText);
  const marker = (m[1] ?? m[4]).toUpperCase();
  const currency = SYMBOLS[marker] ?? marker;
  const body = m[2] ?? m[3];
  const amount = parseAmount(body, priceText);
  if (per === 'kg') return { currency, perKg: amount };
  if (per === 'lb') return { currency, perKg: amount / (LB / 1000) };
  return { currency, perKg: amount / (grams / 1000) };
}

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'uk-UA'];

function minorUnits(currency) {
  return currency === 'JPY' ? 0 : 2;
}

// Plain decimal digits of the shortest round-trip form of n (no exponent).
function decimalDigits(n) {
  const str = String(n);
  const m = str.match(/^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/);
  let int = m[1];
  let frac = m[2] ?? '';
  const exp = Number(m[3] ?? 0);
  if (exp > 0) {
    const all = int + frac.padEnd(exp, '0');
    int = all.slice(0, int.length + exp);
    frac = all.slice(int.length);
  } else if (exp < 0) {
    const all = int.padStart(-exp, '0') + frac;
    frac = all.slice(all.length - frac.length + exp);
    int = all.slice(0, all.length - frac.length) || '0';
  }
  return { int: int.replace(/^0+(?=\d)/, ''), frac };
}

// Round half to even on the decimal digits; returns a decimal string.
export function roundHalfEven(n, digits) {
  const { int, frac } = decimalDigits(n);
  if (frac.length <= digits) return digits ? `${int}.${frac.padEnd(digits, '0')}` : int;
  const keep = frac.slice(0, digits);
  const rest = frac.slice(digits);
  let up;
  if (rest[0] > '5') up = true;
  else if (rest[0] < '5') up = false;
  else if (/[1-9]/.test(rest.slice(1))) up = true;
  else up = Number((keep || int).at(-1)) % 2 === 1;
  let scaled = BigInt(int + keep) + (up ? 1n : 0n);
  let text = scaled.toString().padStart(digits + 1, '0');
  return digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text;
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw bad(amount);
  if (!CODES.includes(currency)) throw bad(currency);
  if (!LOCALES.includes(locale)) throw bad(locale);
  const digits = minorUnits(currency);
  const rounded = roundHalfEven(amount, digits);
  const out = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded);
  return out.replace(/ /g, '\u00A0');
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
