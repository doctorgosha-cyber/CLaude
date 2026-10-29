// Reference solution for task/README.md (scores 25/25 on hidden/cases.mjs). Not part of task/.

const SPACE = /[\s   ]+/g;

function fail(input, why) {
  throw new TypeError(`${why}: ${String(input)}`);
}

// "1.5" or "1,5" → 1.5 (mass/energy numbers: decimal mark only, no grouping)
function plainNumber(s, input) {
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) fail(input, 'bad number');
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) fail(input, 'bad number');
  return n;
}

const UNIT_G = {
  g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125,
  lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237,
};

export function toGrams(spec) {
  if (typeof spec !== 'string') fail(spec, 'mass spec must be a string');
  let s = spec.replace(SPACE, ' ').trim();
  if (!s) fail(spec, 'empty mass spec');
  let count = 1;
  let m = s.match(/^(\d+(?:[.,]\d+)?) ?[×xX] ?(.+)$/);
  if (m) { count = plainNumber(m[1], spec); s = m[2].trim(); }
  m = s.match(/^(.+?) ?\((\d+) ?[^\d()]+\)$/);
  if (m) { count = plainNumber(m[2], spec); s = m[1].trim(); }
  let total = 0;
  const parts = [];
  const re = /^(\d+(?:[.,]\d+)?) ?([a-zA-Z]+)(?: |$)/;
  let rest = s;
  while (rest) {
    const mm = rest.match(re);
    if (!mm) fail(spec, 'unparseable mass spec');
    const u = mm[2].toLowerCase();
    if (!(u in UNIT_G)) fail(spec, 'unknown unit');
    parts.push(u);
    total += plainNumber(mm[1], spec) * UNIT_G[u];
    rest = rest.slice(mm[0].length);
  }
  if (parts.length === 0 || parts.length > 2) fail(spec, 'unparseable mass spec');
  if (parts.length === 2 && !(UNIT_G[parts[0]] === UNIT_G.lb && UNIT_G[parts[1]] === UNIT_G.oz)) fail(spec, 'unparseable mass spec');
  const g = total * count;
  if (!(g > 0)) fail(spec, 'mass must be positive');
  return g;
}

const SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₴': 'UAH' };
const CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'UAH'];

function parsePrice(text) {
  if (typeof text !== 'string') fail(text, 'price must be a string');
  let s = text.replace(SPACE, ' ').trim();
  if (!s) fail(text, 'empty price');
  const markers = [];
  for (const [sym, code] of Object.entries(SYMBOLS)) {
    while (s.includes(sym)) { markers.push(code); s = s.replace(sym, ' '); }
  }
  const codeRe = new RegExp(`(^|[^A-Za-z])(${CODES.join('|')})(?![A-Za-z])`, 'gi');
  s = s.replace(codeRe, (_, pre, code) => { markers.push(code.toUpperCase()); return pre + ' '; });
  if (markers.length !== 1) fail(text, 'expected exactly one currency marker');
  const currency = markers[0];
  s = s.trim();
  if (/[-–—]/.test(s)) {
    if (!/^[\d., ]+[.,][-–—]$/.test(s)) fail(text, 'negative or malformed price');
    s = s.replace(/([.,])[-–—]$/, '$100');
  }
  s = s.replace(/ /g, '');
  if (!/^\d[\d.,]*$/.test(s)) fail(text, 'bad amount');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  let dec = null;
  if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? ',' : '.';
  else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const occurrences = s.split(sep).length - 1;
    const after = s.length - s.lastIndexOf(sep) - 1;
    dec = (occurrences > 1 || after === 3) ? null : sep;
  }
  let clean = '';
  for (const ch of s) {
    if (ch === dec) clean += '.';
    else if (ch === ',' || ch === '.') continue;
    else clean += ch;
  }
  const amount = Number(clean);
  if (!Number.isFinite(amount) || amount <= 0) fail(text, 'amount must be positive');
  return { currency, amount };
}

export function pricePerKg(priceText, massSpec) {
  const { currency, amount } = parsePrice(priceText);
  const grams = toGrams(massSpec);
  return { currency, perKg: amount / (grams / 1000) };
}

const MINOR = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, UAH: 2 };
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'uk-UA'];

// Round half to even on the decimal digits of String(amount). Returns a decimal string.
function roundHalfEven(amount, digits) {
  let str = String(amount);
  if (/e/i.test(str)) str = amount.toFixed(20).replace(/0+$/, '').replace(/\.$/, ''); // very large/small: fall back
  const [intPart, fracPart = ''] = str.split('.');
  const keep = fracPart.slice(0, digits).padEnd(digits, '0');
  const rest = fracPart.slice(digits);
  let base = BigInt(intPart + keep);
  if (rest) {
    const first = rest[0];
    const tailNonZero = /[1-9]/.test(rest.slice(1));
    if (first > '5' || (first === '5' && tailNonZero)) base += 1n;
    else if (first === '5' && base % 2n === 1n) base += 1n;
  }
  const s = base.toString().padStart(digits + 1, '0');
  return digits ? s.slice(0, -digits) + '.' + s.slice(-digits) : s;
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) fail(amount, 'bad amount');
  if (!(currency in MINOR)) fail(currency, 'unknown currency');
  if (!LOCALES.includes(locale)) fail(locale, 'unknown locale');
  const rounded = roundHalfEven(amount, MINOR[currency]);
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: MINOR[currency], maximumFractionDigits: MINOR[currency],
  });
  // already rounded to the minor unit; Intl just lays it out
  return fmt.format(Number(rounded)).replace(/ /g, ' ');
}

export function kcalPer100g(spec) {
  if (typeof spec !== 'string') fail(spec, 'energy spec must be a string');
  const s = spec.replace(SPACE, ' ').trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?) ?(kcal|kj) ?(?:per|\/) ?(100 ?g|kg)$/i);
  if (!m) fail(spec, 'unparseable energy spec');
  let v = plainNumber(m[1], spec);
  if (m[2].toLowerCase() === 'kj') v /= 4.184;
  if (m[3].toLowerCase().replace(/ /g, '') === 'kg') v /= 10;
  if (!(v >= 50 && v <= 900)) fail(spec, 'energy density out of range');
  return v;
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  if (typeof bagGrams !== 'number' || !Number.isFinite(bagGrams) || bagGrams <= 0) fail(bagGrams, 'bad bag size');
  if (typeof dailyGrams !== 'number' || !Number.isFinite(dailyGrams) || dailyGrams <= 0) fail(dailyGrams, 'bad daily amount');
  if (typeof startISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startISO)) fail(startISO, 'start date must be YYYY-MM-DD');
  const [y, mo, d] = startISO.split('-').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d));
  if (start.getUTCFullYear() !== y || start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== d) fail(startISO, 'not a real calendar date');
  const days = Math.floor(bagGrams / dailyGrams);
  if (days < 1) fail(bagGrams, 'less than one whole day of supply');
  const end = new Date(Date.UTC(y, mo - 1, d + days - 1));
  return end.toISOString().slice(0, 10);
}

export function compare(products) {
  if (!Array.isArray(products)) fail(products, 'products must be an array');
  const rows = products.map((p, i) => {
    const id = p && p.id;
    try {
      const { currency, perKg } = pricePerKg(p.price, p.mass);
      return { id, currency, perKg, i };
    } catch {
      return { id, currency: null, perKg: NaN, i };
    }
  });
  rows.sort((a, b) => {
    const an = Number.isNaN(a.perKg), bn = Number.isNaN(b.perKg);
    if (an !== bn) return an ? 1 : -1;
    if (!an && a.perKg !== b.perKg) return a.perKg - b.perKg;
    return a.i - b.i;
  });
  return rows.map(({ id, currency, perKg }) => ({ id, currency, perKg }));
}
