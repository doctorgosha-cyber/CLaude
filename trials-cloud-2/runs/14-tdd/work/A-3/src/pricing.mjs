// src/pricing.mjs — units & price helpers for the comparison tables (see README.md).
// Pure ES module: no I/O, no globals, no time-zone dependence.

// ---------- shared helpers ----------

function fail(input, why) {
  throw new TypeError(`${why}: ${String(input)}`);
}

function requireString(input, what) {
  if (typeof input !== 'string') fail(input, `${what} must be a string`);
  const s = input.trim();
  if (s === '') fail(input, `${what} is empty`);
  return s;
}

// Numbers inside mass / energy specs: "." or "," decimal mark, no grouping.
const NUM = String.raw`(?:\d+(?:[.,]\d+)?|[.,]\d+)`;
function specNumber(str) {
  return Number(str.replace(',', '.'));
}

const GRAMS_PER_OZ = 28.349523125;
const GRAMS_PER_LB = 453.59237;

const CURRENCIES = {
  USD: { symbol: '$', minor: 2 },
  EUR: { symbol: '€', minor: 2 },
  GBP: { symbol: '£', minor: 2 },
  JPY: { symbol: '¥', minor: 0 },
  CHF: { symbol: null, minor: 2 },
  UAH: { symbol: '₴', minor: 2 },
};
const SYMBOL_TO_CODE = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };

const LOCALES = {
  'en-US': { group: ',', decimal: '.', symbolFirst: true },
  'de-DE': { group: '.', decimal: ',', symbolFirst: false },
  'fr-FR': { group: ' ', decimal: ',', symbolFirst: false },
  'uk-UA': { group: ' ', decimal: ',', symbolFirst: false },
};

// ---------- toGrams ----------

const MASS_UNIT = String.raw`(kilograms?|kg|grams?|g|pounds?|lbs?|ounces?|oz)`;
const MASS_RE = new RegExp(
  String.raw`^(?:(\d+)\s*[×x]\s*)?(${NUM})\s*${MASS_UNIT}(?:\s*(${NUM})\s*${MASS_UNIT})?(?:\s*\((\d+)\s*\p{L}+\))?$`,
  'iu',
);

function unitFactor(unit) {
  const u = unit.toLowerCase();
  if (u === 'g' || u.startsWith('gram')) return { factor: 1, kind: 'g' };
  if (u === 'kg' || u.startsWith('kilogram')) return { factor: 1000, kind: 'kg' };
  if (u === 'oz' || u.startsWith('ounce')) return { factor: GRAMS_PER_OZ, kind: 'oz' };
  return { factor: GRAMS_PER_LB, kind: 'lb' }; // lb, lbs, pound(s)
}

export function toGrams(spec) {
  const s = requireString(spec, 'mass spec');
  const m = MASS_RE.exec(s);
  if (!m) fail(spec, 'unparseable mass spec');
  const [, leadCount, n1, u1, n2, u2, trailCount] = m;
  if (leadCount !== undefined && trailCount !== undefined) fail(spec, 'mass spec has two multipack counts');

  const first = unitFactor(u1);
  let grams = specNumber(n1) * first.factor;
  if (n2 !== undefined) {
    const second = unitFactor(u2);
    if (!(first.kind === 'lb' && second.kind === 'oz')) fail(spec, 'invalid compound mass spec');
    grams += specNumber(n2) * second.factor;
  }
  const count = leadCount !== undefined ? Number(leadCount) : trailCount !== undefined ? Number(trailCount) : 1;
  grams *= count;
  if (!Number.isFinite(grams) || grams <= 0) fail(spec, 'mass must be a positive finite quantity');
  return grams;
}

// ---------- pricePerKg ----------

const UNIT_PRICE_RE = /\s*(?:\/|per)\s*(kg|lb)\s*$/i;
const PRICE_MARKER = String.raw`([$€£¥₴]|USD|EUR|GBP|JPY|CHF|UAH)`;
const PRICE_RE = new RegExp(String.raw`^(?:${PRICE_MARKER}\s*)?([\d\s.,]*\d[\d\s.,]*)(?:\s*${PRICE_MARKER})?$`, 'iu');

function parseAmount(raw, forcedDecimal, original) {
  const s = raw.replace(/\s/gu, '');
  const commas = (s.match(/,/g) || []).length;
  const dots = (s.match(/\./g) || []).length;
  let dec = null;
  if (forcedDecimal) {
    dec = forcedDecimal;
  } else if (commas && dots) {
    dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
  } else if (commas || dots) {
    const ch = commas ? ',' : '.';
    const n = commas || dots;
    const groupTail = new RegExp(`\\${ch}\\d{3}$`).test(s);
    dec = n > 1 || groupTail ? null : ch;
  }
  let normalised;
  if (dec) {
    const i = s.lastIndexOf(dec);
    normalised = s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1).replace(/[.,]/g, '');
  } else {
    normalised = s.replace(/[.,]/g, '');
  }
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(normalised)) fail(original, 'unparseable amount in price');
  const value = Number(normalised);
  if (!Number.isFinite(value) || value <= 0) fail(original, 'price amount must be positive');
  return value;
}

function parsePrice(priceText) {
  let s = requireString(priceText, 'price text');

  let unit = null;
  const um = UNIT_PRICE_RE.exec(s);
  if (um) {
    unit = um[1].toLowerCase();
    s = s.slice(0, um.index).trim();
  }

  // "12.–", "12.-", "12,—": a dash right after the decimal mark means zero minor units.
  let forcedDecimal = null;
  const dm = /^(.*\d)([.,])[-–—](.*)$/su.exec(s);
  if (dm) {
    forcedDecimal = dm[2];
    s = `${dm[1]}${dm[2]}00${dm[3]}`;
  }
  if (/[-−–—]/u.test(s)) fail(priceText, 'negative or dashed price');

  const m = PRICE_RE.exec(s);
  if (!m) fail(priceText, 'unparseable price text');
  const [, before, amountRaw, after] = m;
  if ((before === undefined) === (after === undefined)) fail(priceText, 'price needs exactly one currency marker');
  const marker = before ?? after;
  const currency = SYMBOL_TO_CODE[marker] ?? marker.toUpperCase();
  const amount = parseAmount(amountRaw, forcedDecimal, priceText);
  return { currency, amount, unit };
}

export function pricePerKg(priceText, massSpec) {
  const { currency, amount, unit } = parsePrice(priceText);
  const grams = toGrams(massSpec);
  let perKg;
  if (unit === 'kg') perKg = amount;
  else if (unit === 'lb') perKg = amount / 0.45359237;
  else perKg = amount / (grams / 1000);
  return { currency, perKg };
}

// ---------- formatMoney ----------

// Expand String(n) (shortest round-trip) into plain positional decimal digits.
function toPlainDecimal(n) {
  const s = String(n);
  if (!s.includes('e')) return s;
  const [mant, expStr] = s.split('e');
  const e = Number(expStr);
  const [ip, fp = ''] = mant.split('.');
  const digits = ip + fp;
  const point = ip.length + e;
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

// Round half to even on the decimal digits of String(n); returns "1234.56" style text.
function roundHalfEvenText(n, minor) {
  const [ip, fp = ''] = toPlainDecimal(n).split('.');
  if (fp.length <= minor) return minor ? `${ip}.${fp.padEnd(minor, '0')}` : ip;
  const kept = ip + fp.slice(0, minor);
  const rest = fp.slice(minor);
  let roundUp;
  if (rest[0] > '5') roundUp = true;
  else if (rest[0] < '5') roundUp = false;
  else if (/[1-9]/.test(rest.slice(1))) roundUp = true;
  else roundUp = Number(kept[kept.length - 1]) % 2 === 1;
  const str = (BigInt(kept) + (roundUp ? 1n : 0n)).toString().padStart(minor + 1, '0');
  const cut = str.length - minor;
  return minor ? `${str.slice(0, cut)}.${str.slice(cut)}` : str;
}

function requireCurrency(currency) {
  if (typeof currency !== 'string' || !Object.hasOwn(CURRENCIES, currency)) fail(currency, 'unknown currency');
  return CURRENCIES[currency];
}

function roundToMinor(amount, currency) {
  return Number(roundHalfEvenText(amount, requireCurrency(currency).minor));
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) fail(amount, 'amount must be a finite non-negative number');
  const cur = requireCurrency(currency);
  if (typeof locale !== 'string' || !Object.hasOwn(LOCALES, locale)) fail(locale, 'unsupported locale');
  const loc = LOCALES[locale];

  const [ip, fp] = roundHalfEvenText(amount, cur.minor).split('.');
  const grouped = ip.replace(/\B(?=(\d{3})+$)/g, loc.group);
  const number = fp !== undefined ? `${grouped}${loc.decimal}${fp}` : grouped;

  if (loc.symbolFirst) {
    return cur.symbol ? `${cur.symbol}${number}` : `${currency} ${number}`;
  }
  return `${number} ${cur.symbol ?? currency}`;
}

// ---------- kcalPer100g ----------

const ENERGY_RE = new RegExp(String.raw`^(${NUM})\s*(kcal|kj)\s*(?:\/|per)\s*(100\s*g|kg)$`, 'iu');

export function kcalPer100g(spec) {
  const s = requireString(spec, 'energy spec');
  const m = ENERGY_RE.exec(s);
  if (!m) fail(spec, 'unparseable energy spec');
  let value = specNumber(m[1]);
  if (m[2].toLowerCase() === 'kj') value /= 4.184;
  if (m[3].toLowerCase() === 'kg') value /= 10;
  if (!Number.isFinite(value) || value < 50 || value > 900) fail(spec, 'energy density outside 50…900 kcal/100 g');
  return value;
}

// ---------- daysSupply ----------

function massArg(value, what) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) fail(value, `${what} must be a positive number of grams`);
    return value;
  }
  if (typeof value === 'string') return toGrams(value);
  fail(value, `${what} must be a number or a mass spec`);
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  const bag = massArg(bagGrams, 'bag mass');
  const daily = massArg(dailyGrams, 'daily mass');
  const days = Math.floor(bag / daily + 1e-9);
  if (!(days >= 1)) fail(`${String(bagGrams)} / ${String(dailyGrams)}`, 'fewer than one whole day of supply');

  if (typeof startISO !== 'string') fail(startISO, 'start date must be a string');
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startISO);
  if (!dm) fail(startISO, 'start date must be YYYY-MM-DD');
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const start = new Date(0);
  start.setUTCFullYear(y, mo - 1, d);
  if (start.getUTCFullYear() !== y || start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== d) {
    fail(startISO, 'start date is not a real calendar date');
  }

  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + days - 1);
  if (Number.isNaN(end.getTime())) fail(`${String(bagGrams)} / ${String(dailyGrams)}`, 'supply period out of range');
  return `${pad(end.getUTCFullYear(), 4)}-${pad(end.getUTCMonth() + 1, 2)}-${pad(end.getUTCDate(), 2)}`;
}

// ---------- compare ----------

export function compare(products) {
  if (!Array.isArray(products)) fail(products, 'products must be an array');
  const valid = [];
  const invalid = [];
  products.forEach((item, index) => {
    const id = item == null ? undefined : item.id;
    try {
      const { currency, perKg } = pricePerKg(item.price, item.mass);
      valid.push({ id, currency, perKg: roundToMinor(perKg, currency), index });
    } catch {
      invalid.push({ id, currency: null, perKg: NaN });
    }
  });
  valid.sort((a, b) => a.perKg - b.perKg || a.index - b.index);
  return [...valid.map(({ id, currency, perKg }) => ({ id, currency, perKg })), ...invalid];
}
