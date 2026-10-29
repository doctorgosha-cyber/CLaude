// src/pricing.mjs — units & price helpers for the comparison tables (see README.md).
// Pure ES module: no I/O, no globals, no dependencies, time-zone independent.

// ---------- shared helpers ----------

function show(x) {
  try {
    return typeof x === 'string' ? x : String(x);
  } catch {
    return typeof x;
  }
}

function fail(what, input) {
  return new TypeError(`invalid ${what}: ${show(input)}`);
}

// Collapse every Unicode space (U+0020, U+00A0, U+202F, U+2009, …) to U+0020 and trim.
function norm(s) {
  return s.replace(/\s/g, ' ').trim();
}

const NUM = String.raw`(?:\d+(?:[.,]\d+)?|[.,]\d+)`;

function toNumber(numText) {
  return Number(numText.replace(',', '.'));
}

// Plain decimal digits of the shortest round-trip representation (String(n)),
// with any exponent expanded. Returns { int, frac } digit strings (no sign; n >= 0).
function plainDecimal(n) {
  let s = String(n);
  let int, frac, exp = 0;
  const e = s.indexOf('e');
  if (e !== -1) {
    exp = Number(s.slice(e + 1));
    s = s.slice(0, e);
  }
  const dot = s.indexOf('.');
  if (dot === -1) { int = s; frac = ''; } else { int = s.slice(0, dot); frac = s.slice(dot + 1); }
  if (exp > 0) {
    const digits = int + frac;
    const pos = int.length + exp;
    int = digits.slice(0, pos).padEnd(pos, '0');
    frac = digits.slice(pos);
  } else if (exp < 0) {
    const digits = int + frac;
    const pos = int.length + exp;
    if (pos <= 0) { int = '0'; frac = '0'.repeat(-pos) + digits; }
    else { int = digits.slice(0, pos); frac = digits.slice(pos); }
  }
  int = int.replace(/^0+(?=\d)/, '');
  if (int === '') int = '0';
  return { int, frac };
}

// Round half to even on decimal digits to `d` fraction digits. Returns { int, frac }.
function roundHalfEven(n, d) {
  let { int, frac } = plainDecimal(n);
  if (frac.length <= d) return { int, frac: frac.padEnd(d, '0') };
  const kept = int + frac.slice(0, d);
  const next = frac.charCodeAt(d) - 48;
  const rest = frac.slice(d + 1);
  let roundUp;
  if (next > 5) roundUp = true;
  else if (next < 5) roundUp = false;
  else if (/[1-9]/.test(rest)) roundUp = true;
  else roundUp = (kept.charCodeAt(kept.length - 1) - 48) % 2 === 1;
  let digits = roundUp ? (BigInt(kept) + 1n).toString() : kept;
  digits = digits.padStart(d + 1, '0');
  return { int: digits.slice(0, digits.length - d), frac: digits.slice(digits.length - d) };
}

const CURRENCIES = {
  USD: { symbol: '$', minor: 2 },
  EUR: { symbol: '€', minor: 2 },
  GBP: { symbol: '£', minor: 2 },
  JPY: { symbol: '¥', minor: 0 },
  CHF: { symbol: null, minor: 2 },
  UAH: { symbol: '₴', minor: 2 },
};

const SYMBOL_TO_CODE = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };

// ---------- toGrams ----------

const UNIT_GRAMS = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
};

const TERM_RE = new RegExp(
  String.raw`(${NUM})\s*(kilograms?|kg|grams?|g|ounces?|oz|pounds?|lbs?)(?![a-z])\s*`,
  'iy',
);

export function toGrams(spec) {
  if (typeof spec !== 'string') throw fail('mass spec', spec);
  let s = norm(spec);
  let count = 1;

  const lead = /^(\d+)\s*[×xX]\s*(.*)$/.exec(s);
  if (lead) {
    count = Number(lead[1]);
    s = lead[2];
  }
  const trail = /^(.*?)\s*\(\s*(\d+)\s*\p{L}+\s*\)$/u.exec(s);
  if (trail) {
    if (lead) throw fail('mass spec', spec); // never both
    count = Number(trail[2]);
    s = trail[1];
  }
  if (!(count >= 1) || !Number.isInteger(count)) throw fail('mass spec', spec);

  let grams = 0;
  let pos = 0;
  let terms = 0;
  while (pos < s.length) {
    TERM_RE.lastIndex = pos;
    const m = TERM_RE.exec(s);
    if (!m) throw fail('mass spec', spec);
    grams += toNumber(m[1]) * UNIT_GRAMS[m[2].toLowerCase()];
    pos = TERM_RE.lastIndex;
    terms++;
  }
  if (terms === 0) throw fail('mass spec', spec);

  const total = count * grams;
  if (!Number.isFinite(total) || total <= 0) throw fail('mass spec', spec);
  return total;
}

// ---------- pricePerKg ----------

const MARKER = String.raw`\$|€|£|¥|₴|USD|EUR|GBP|JPY|CHF|UAH`;
const PRICE_RE = new RegExp(
  String.raw`^(?:(${MARKER})\s*)?(\d[\d .,]*?(?:[.,][-–—−])?)(?:\s*(${MARKER}))?$`,
  'i',
);
const UNIT_PRICE_RE = /\s*(?:\/|per)\s*(kg|lb)$/i;
const LB_IN_KG = 0.45359237;

function parsePrice(priceText) {
  if (typeof priceText !== 'string') throw fail('price', priceText);
  let s = norm(priceText);

  let per = null;
  const unit = UNIT_PRICE_RE.exec(s);
  if (unit) {
    per = unit[1].toLowerCase();
    s = s.slice(0, unit.index).trim();
  }

  const m = PRICE_RE.exec(s);
  if (!m) throw fail('price', priceText);
  const markers = [m[1], m[3]].filter(Boolean);
  if (markers.length !== 1) throw fail('price', priceText);
  const marker = markers[0];
  const currency = SYMBOL_TO_CODE[marker] ?? marker.toUpperCase();

  let amt = m[2].trim();
  // "12.–" / "12.-" / "12,—": a dash after the decimal mark means zero minor units.
  const dash = /([.,])[-–—−]$/.exec(amt);
  if (dash) amt = amt.slice(0, dash.index);
  if (/[-–—−]/.test(amt)) throw fail('price', priceText);

  const hasComma = amt.includes(',');
  const hasDot = amt.includes('.');
  let decimal = null;
  if (hasComma && hasDot) {
    // Both present: the last one is the decimal mark, the other groups thousands.
    decimal = amt.lastIndexOf(',') > amt.lastIndexOf('.') ? ',' : '.';
  } else if (hasComma || hasDot) {
    // Only one: thousands separator when repeated or followed by exactly three digits.
    const sep = hasComma ? ',' : '.';
    const parts = amt.split(sep);
    if (!(parts.length > 2 || /^\d{3}$/.test(parts[1]))) decimal = sep;
  }
  let intPart = amt;
  let fracPart = '';
  if (decimal) {
    const i = amt.lastIndexOf(decimal);
    intPart = amt.slice(0, i);
    fracPart = amt.slice(i + 1);
    if (!/^\d+$/.test(fracPart)) throw fail('price', priceText);
  }
  // Integer digits are either ungrouped or grouped in threes by space, "," or ".".
  if (!/^\d+$/.test(intPart) && !/^\d{1,3}(?:[ .,]\d{3})+$/.test(intPart)) throw fail('price', priceText);
  const normalized = intPart.replace(/[ .,]/g, '') + (fracPart ? `.${fracPart}` : '');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) throw fail('price', priceText);

  return { currency, amount, per };
}

export function pricePerKg(priceText, massSpec) {
  const { currency, amount, per } = parsePrice(priceText);
  const grams = toGrams(massSpec);
  let perKg;
  if (per === 'kg') perKg = amount;
  else if (per === 'lb') perKg = amount / LB_IN_KG;
  else perKg = amount / (grams / 1000);
  return { currency, perKg };
}

// ---------- formatMoney ----------

const LOCALES = {
  'en-US': { group: ',', decimal: '.', prefix: true },
  'de-DE': { group: '.', decimal: ',', prefix: false },
  'fr-FR': { group: ' ', decimal: ',', prefix: false },
  'uk-UA': { group: ' ', decimal: ',', prefix: false },
};

function groupDigits(int, sep) {
  let out = '';
  for (let i = int.length; i > 0; i -= 3) {
    const chunk = int.slice(Math.max(0, i - 3), i);
    out = out ? chunk + sep + out : chunk;
  }
  return out;
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw fail('amount', amount);
  const cur = typeof currency === 'string' ? CURRENCIES[currency] : undefined;
  if (!cur) throw fail('currency', currency);
  const loc = typeof locale === 'string' ? LOCALES[locale] : undefined;
  if (!loc) throw fail('locale', locale);

  const { int, frac } = roundHalfEven(amount, cur.minor);
  const number = groupDigits(int, loc.group) + (frac ? loc.decimal + frac : '');
  const sym = cur.symbol;
  if (loc.prefix) {
    return sym ? sym + number : `${currency} ${number}`;
  }
  return `${number} ${sym ?? currency}`;
}

// ---------- kcalPer100g ----------

const KJ_PER_KCAL = 4.184;
const ENERGY_RE = new RegExp(String.raw`^(${NUM})\s*(kcal|kj)\s*(?:\/|per)\s*(100\s*g|kg)$`, 'i');

export function kcalPer100g(spec) {
  if (typeof spec !== 'string') throw fail('energy spec', spec);
  const m = ENERGY_RE.exec(norm(spec));
  if (!m) throw fail('energy spec', spec);
  let value = toNumber(m[1]);
  if (m[2].toLowerCase() === 'kj') value /= KJ_PER_KCAL;
  if (m[3].toLowerCase() === 'kg') value /= 10;
  if (!Number.isFinite(value) || value < 50 || value > 900) throw fail('energy spec', spec);
  return value;
}

// ---------- daysSupply ----------

function massArg(x, what) {
  if (typeof x === 'number') {
    if (!Number.isFinite(x) || x <= 0) throw fail(what, x);
    return x;
  }
  if (typeof x === 'string') return toGrams(x);
  throw fail(what, x);
}

const DAY_MS = 86400000;

export function daysSupply(bagGrams, dailyGrams, startISO) {
  const bag = massArg(bagGrams, 'bag mass');
  const daily = massArg(dailyGrams, 'daily mass');
  const days = Math.floor(bag / daily);
  if (!Number.isFinite(days) || days < 1) throw fail('days supply', `${show(bagGrams)} / ${show(dailyGrams)}`);

  if (typeof startISO !== 'string') throw fail('start date', startISO);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startISO);
  if (!m) throw fail('start date', startISO);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const start = Date.UTC(y, mo - 1, d);
  const check = new Date(start);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw fail('start date', startISO);
  }

  const end = new Date(start + (days - 1) * DAY_MS);
  const pad = (n, w) => String(n).padStart(w, '0');
  return `${pad(end.getUTCFullYear(), 4)}-${pad(end.getUTCMonth() + 1, 2)}-${pad(end.getUTCDate(), 2)}`;
}

// ---------- compare ----------

function roundToMinor(value, currency) {
  const { int, frac } = roundHalfEven(value, CURRENCIES[currency].minor);
  return Number(frac ? `${int}.${frac}` : int);
}

export function compare(products) {
  if (!Array.isArray(products)) throw fail('products', products);
  const valid = [];
  const invalid = [];
  for (const item of products) {
    const id = item != null && typeof item === 'object' ? item.id : undefined;
    try {
      const { currency, perKg } = pricePerKg(item.price, item.mass);
      valid.push({ id, currency, perKg: roundToMinor(perKg, currency) });
    } catch {
      invalid.push({ id, currency: null, perKg: NaN });
    }
  }
  valid.sort((a, b) => a.perKg - b.perKg); // stable sort keeps input order on ties
  return valid.concat(invalid);
}
