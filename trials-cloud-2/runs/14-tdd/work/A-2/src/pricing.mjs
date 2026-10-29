// src/pricing.mjs — units & price helpers for the comparison tables (see README.md).
// Pure module: no I/O, no globals, time-zone independent.

const SP = '[ \\u00A0\\u202F\\u2009]';
const NUM = '(\\d+(?:[.,]\\d+)?)';
const MASS_UNIT = '(g|grams?|kg|kilograms?|oz|ounces?|lbs?|pounds?)';

const OZ_G = 28.349523125;
const LB_G = 453.59237;

const CURRENCIES = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, UAH: 2 };
const SYMBOLS = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };
const LOCALES = new Set(['en-US', 'de-DE', 'fr-FR', 'uk-UA']);

function show(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'bigint') return `${value}n`;
  try {
    const s = JSON.stringify(value);
    if (s !== undefined) return s;
  } catch {}
  return String(value);
}

function fail(what, value) {
  throw new TypeError(`${what}: ${show(value)}`);
}

function num(text) {
  return Number(text.replace(',', '.'));
}

function unitGrams(unit) {
  switch (unit.toLowerCase()) {
    case 'g': case 'gram': case 'grams': return 1;
    case 'kg': case 'kilogram': case 'kilograms': return 1000;
    case 'oz': case 'ounce': case 'ounces': return OZ_G;
    case 'lb': case 'lbs': case 'pound': case 'pounds': return LB_G;
    default: return NaN;
  }
}

const LEADING_COUNT = new RegExp(`^(\\d+)${SP}*[×xX]${SP}*(.+)$`);
const TRAILING_COUNT = new RegExp(`^(.+?)${SP}*\\(${SP}*(\\d+)${SP}+[^\\s()]+${SP}*\\)$`);
const SINGLE = new RegExp(`^${NUM}${SP}*${MASS_UNIT}$`, 'i');
const COMPOUND = new RegExp(`^${NUM}${SP}*(lbs?|pounds?)${SP}+${NUM}${SP}*(oz|ounces?)$`, 'i');

export function toGrams(spec) {
  if (typeof spec !== 'string') fail('invalid mass spec', spec);
  let text = spec.trim();
  let count = 1;

  let m = LEADING_COUNT.exec(text);
  if (m) {
    count = Number(m[1]);
    text = m[2].trim();
  } else if ((m = TRAILING_COUNT.exec(text))) {
    count = Number(m[2]);
    text = m[1].trim();
  }

  let grams;
  if ((m = SINGLE.exec(text))) {
    grams = num(m[1]) * unitGrams(m[2]);
  } else if ((m = COMPOUND.exec(text))) {
    grams = num(m[1]) * unitGrams(m[2]) + num(m[3]) * unitGrams(m[4]);
  } else {
    fail('invalid mass spec', spec);
  }

  const total = grams * count;
  if (!Number.isFinite(total) || total <= 0) fail('invalid mass spec', spec);
  return total;
}

const UNIT_PRICE = /(?:\/|per)\s*(kg|lb)$/i;
const MARKER = '([$€£¥₴]|USD|EUR|GBP|JPY|CHF|UAH)';
const PRICE_SHAPE = new RegExp(`^(?:${MARKER}\\s*(.+)|(.+?)\\s*${MARKER})$`, 'i');
const DASH_ZERO = /([.,])[-‐-―−]$/;
const AMOUNT_SHAPE = /^\d+(?:[\s.,]\d+)*$/;

function currencyOf(marker) {
  return SYMBOLS[marker] ?? marker.toUpperCase();
}

function parseAmount(text) {
  let s = text.trim();
  let forceInteger = false;
  const dash = DASH_ZERO.exec(s);
  if (dash) {
    s = s.slice(0, dash.index);
    forceInteger = true;
  }
  if (!AMOUNT_SHAPE.test(s)) return NaN;
  s = s.replace(/\s/g, '');
  if (forceInteger) return Number(s.replace(/[.,]/g, ''));

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    s = s.split(group).join('');
    if (s.indexOf(decimal) !== s.lastIndexOf(decimal)) return NaN;
    return Number(s.replace(decimal, '.'));
  }
  if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const first = s.indexOf(sep);
    const multiple = first !== s.lastIndexOf(sep);
    const threeDigits = s.length - first - 1 === 3;
    if (multiple || threeDigits) return Number(s.split(sep).join(''));
    return Number(s.replace(sep, '.'));
  }
  return Number(s);
}

function parsePrice(priceText) {
  if (typeof priceText !== 'string') fail('invalid price', priceText);
  let text = priceText.trim();
  let per = null;
  const unit = UNIT_PRICE.exec(text);
  if (unit) {
    per = unit[1].toLowerCase();
    text = text.slice(0, unit.index).trim();
  }
  const m = PRICE_SHAPE.exec(text);
  if (!m) fail('invalid price', priceText);
  const marker = m[1] ?? m[4];
  const amountText = m[1] !== undefined ? m[2] : m[3];
  const amount = parseAmount(amountText);
  if (!Number.isFinite(amount) || amount <= 0) fail('invalid price', priceText);
  return { currency: currencyOf(marker), amount, per };
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

// Decimal digits of the shortest round-trip representation, without exponent.
function plainDecimal(n) {
  let s = String(n);
  const e = s.indexOf('e');
  if (e === -1) return s;
  const mant = s.slice(0, e);
  const exp = Number(s.slice(e + 1));
  const [ip, fp = ''] = mant.split('.');
  const digits = ip + fp;
  const point = ip.length + exp;
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return digits.slice(0, point) + '.' + digits.slice(point);
}

// Round half to even on the decimal digits of String(amount); returns a decimal string.
function roundHalfEven(amount, digits) {
  const [ip, fp = ''] = plainDecimal(amount).split('.');
  const kept = fp.slice(0, digits).padEnd(digits, '0');
  const rest = fp.slice(digits);
  let value = BigInt(ip + kept);
  if (rest.length > 0) {
    const head = rest[0];
    const tail = rest.slice(1);
    const tailZero = /^0*$/.test(tail);
    if (head > '5' || (head === '5' && !tailZero) || (head === '5' && tailZero && value % 2n === 1n)) {
      value += 1n;
    }
  }
  let str = value.toString();
  if (digits === 0) return str;
  str = str.padStart(digits + 1, '0');
  return str.slice(0, -digits) + '.' + str.slice(-digits);
}

function roundToMinor(amount, currency) {
  return Number(roundHalfEven(amount, CURRENCIES[currency]));
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) fail('invalid amount', amount);
  if (typeof currency !== 'string' || !Object.hasOwn(CURRENCIES, currency)) fail('invalid currency', currency);
  if (typeof locale !== 'string' || !LOCALES.has(locale)) fail('invalid locale', locale);
  const digits = CURRENCIES[currency];
  const rounded = Number(roundHalfEven(amount, digits));
  const out = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rounded);
  return out.replace(/ /g, ' ');
}

const ENERGY = new RegExp(`^${NUM}${SP}*(kcal|kJ)${SP}*(?:\\/|per)${SP}*(100${SP}*g|kg)$`, 'i');

export function kcalPer100g(spec) {
  if (typeof spec !== 'string') fail('invalid energy spec', spec);
  const m = ENERGY.exec(spec.trim());
  if (!m) fail('invalid energy spec', spec);
  let value = num(m[1]);
  if (m[2].toLowerCase() === 'kj') value /= 4.184;
  if (m[3].toLowerCase() === 'kg') value /= 10;
  if (!Number.isFinite(value) || value < 50 || value > 900) fail('invalid energy spec', spec);
  return value;
}

function gramsArg(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) fail('invalid mass', value);
    return value;
  }
  return toGrams(value);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(n, width) {
  return String(n).padStart(width, '0');
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  const bag = gramsArg(bagGrams);
  const daily = gramsArg(dailyGrams);
  if (typeof startISO !== 'string') fail('invalid date', startISO);
  const m = ISO_DATE.exec(startISO);
  if (!m) fail('invalid date', startISO);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = new Date(Date.UTC(y, mo - 1, d));
  start.setUTCFullYear(y); // years 0–99 would otherwise map to 1900–1999
  if (start.getUTCFullYear() !== y || start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== d) {
    fail('invalid date', startISO);
  }
  const days = Math.floor(bag / daily);
  if (!Number.isFinite(days) || days < 1) fail('bag lasts less than one day', `${show(bagGrams)} / ${show(dailyGrams)}`);
  const last = new Date(start.getTime() + (days - 1) * 86400000);
  if (Number.isNaN(last.getTime())) fail('invalid days supply', days);
  return `${pad(last.getUTCFullYear(), 4)}-${pad(last.getUTCMonth() + 1, 2)}-${pad(last.getUTCDate(), 2)}`;
}

export function compare(products) {
  if (!Array.isArray(products)) fail('invalid products', products);
  const valid = [];
  const invalid = [];
  products.forEach((item) => {
    const id = item == null ? undefined : item.id;
    try {
      const { currency, perKg } = pricePerKg(item.price, item.mass);
      valid.push({ id, currency, perKg: roundToMinor(perKg, currency) });
    } catch {
      invalid.push({ id, currency: null, perKg: NaN });
    }
  });
  valid.sort((a, b) => a.perKg - b.perKg); // Array.prototype.sort is stable
  return valid.concat(invalid);
}
