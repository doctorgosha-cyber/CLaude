// src/pricing.mjs — units & price helpers for the comparison tables (pure, no deps)

const OZ_G = 28.349523125;
const LB_G = 453.59237;
const KCAL_KJ = 4.184;

const CURRENCIES = {
  USD: { symbol: "$", minor: 2 },
  EUR: { symbol: "€", minor: 2 },
  GBP: { symbol: "£", minor: 2 },
  JPY: { symbol: "¥", minor: 0 },
  CHF: { symbol: null, minor: 2 },
  UAH: { symbol: "₴", minor: 2 },
};
const SYMBOL_TO_CODE = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₴": "UAH" };
const NBSP = " ";
const LOCALES = {
  "en-US": { group: ",", decimal: ".", symbolFirst: true },
  "de-DE": { group: ".", decimal: ",", symbolFirst: false },
  "fr-FR": { group: " ", decimal: ",", symbolFirst: false },
  "uk-UA": { group: NBSP, decimal: ",", symbolFirst: false },
};

function show(x) {
  try {
    return typeof x === "string" ? x : String(x);
  } catch {
    return typeof x;
  }
}
function fail(label, value) {
  throw new TypeError(`Invalid ${label}: ${show(value)}`);
}
function parseDecimal(text) {
  return Number(text.replace(",", "."));
}

// ---------- decimal rounding (half to even on the shortest round-trip digits) ----------

function expandExponent(s) {
  const m = /^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(s);
  if (!m) return s;
  const [, sign, intPart, fracPart = "", exp] = m;
  let digits = intPart + fracPart;
  let point = intPart.length + Number(exp);
  if (point <= 0) {
    digits = "0".repeat(1 - point) + digits;
    point = 1;
  } else if (point > digits.length) {
    digits = digits + "0".repeat(point - digits.length);
  }
  const ip = digits.slice(0, point).replace(/^0+(?=\d)/, "");
  const fp = digits.slice(point);
  return sign + ip + (fp ? "." + fp : "");
}

function roundDecimalString(n, d) {
  let s = expandExponent(String(n));
  if (s.startsWith("-")) s = s.slice(1);
  const [ip, fp = ""] = s.split(".");
  if (fp.length <= d) return d ? ip + "." + fp.padEnd(d, "0") : ip;
  const keep = fp.slice(0, d);
  const rest = fp.slice(d);
  let up;
  if (rest[0] > "5") up = true;
  else if (rest[0] < "5") up = false;
  else if (/[1-9]/.test(rest.slice(1))) up = true;
  else {
    const last = (keep || ip).slice(-1);
    up = Number(last) % 2 === 1;
  }
  let digits = ip + keep;
  if (up) digits = (BigInt(digits) + 1n).toString().padStart(digits.length, "0");
  const ni = digits.slice(0, digits.length - d) || "0";
  const nf = digits.slice(digits.length - d);
  return d ? ni + "." + nf : ni;
}

// ---------- toGrams ----------

const LEADING_COUNT = /^(\d+)\s*(?:×|x)\s*(?=\S)/i;
const TRAILING_PACK = /^(.*?)\s*\(\s*(\d+)\s*([^\s()\d][^\s()]*)\s*\)$/;
const MASS_TOKEN = /^\s*(\d+(?:[.,]\d*)?|[.,]\d+)\s*(kilograms?|kg|grams?|g|ounces?|oz|pounds?|lbs?)(?![a-z])/i;

function unitFactor(unit) {
  switch (unit[0].toLowerCase()) {
    case "k": return 1000;
    case "g": return 1;
    case "o": return OZ_G;
    case "l":
    case "p": return LB_G;
    default: return NaN;
  }
}

export function toGrams(spec) {
  if (typeof spec !== "string") fail("mass spec", spec);
  let body = spec.trim();
  let multiplier = 1;
  const lead = LEADING_COUNT.exec(body);
  if (lead) {
    multiplier = Number(lead[1]);
    body = body.slice(lead[0].length);
  } else {
    const trail = TRAILING_PACK.exec(body);
    if (trail) {
      multiplier = Number(trail[2]);
      body = trail[1];
    }
  }
  let rest = body;
  let total = 0;
  let count = 0;
  while (rest.trim() !== "") {
    const m = MASS_TOKEN.exec(rest);
    if (!m) fail("mass spec", spec);
    const value = parseDecimal(m[1]);
    const factor = unitFactor(m[2]);
    if (!Number.isFinite(value) || !Number.isFinite(factor)) fail("mass spec", spec);
    total += value * factor;
    rest = rest.slice(m[0].length);
    count++;
  }
  if (count === 0) fail("mass spec", spec);
  const grams = total * multiplier;
  if (!Number.isFinite(grams) || grams <= 0) fail("mass spec", spec);
  return grams;
}

// ---------- pricePerKg ----------

function parseAmount(raw, original) {
  let s = raw.replace(/([.,])\s*[-–—]$/, (_, mark) => mark + "00");
  if (!/^[\d\s.,]+$/.test(s) || !/\d/.test(s)) fail("price", original);
  s = s.replace(/\s+/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("");
    if (dec === ",") s = s.replace(",", ".");
  } else if (hasComma || hasDot) {
    const ch = hasComma ? "," : ".";
    const occurrences = s.split(ch).length - 1;
    const idx = s.indexOf(ch);
    const isThousands =
      occurrences > 1 ||
      (/^\d+$/.test(s.slice(0, idx)) && s.length - idx - 1 === 3);
    if (isThousands) s = s.split(ch).join("");
    else if (ch === ",") s = s.replace(",", ".");
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) fail("price", original);
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) fail("price", original);
  return n;
}

const UNIT_PRICE_SUFFIX = /(?:\/|per)\s*(kg|lb)$/i;
const CURRENCY_MARKER = /[$€£¥₴]|(?<![a-z])(?:usd|eur|gbp|jpy|chf|uah)(?![a-z])/gi;

export function pricePerKg(priceText, massSpec) {
  const grams = toGrams(massSpec);
  if (typeof priceText !== "string") fail("price", priceText);
  let text = priceText.trim();
  let unit = null;
  const um = UNIT_PRICE_SUFFIX.exec(text);
  if (um) {
    unit = um[1].toLowerCase();
    text = text.slice(0, um.index).trim();
  }
  const markers = [...text.matchAll(CURRENCY_MARKER)];
  if (markers.length !== 1) fail("price", priceText);
  const [m] = markers;
  const atStart = m.index === 0;
  const atEnd = m.index + m[0].length === text.length;
  if (!atStart && !atEnd) fail("price", priceText);
  const currency = SYMBOL_TO_CODE[m[0]] ?? m[0].toUpperCase();
  const amountText = (atStart ? text.slice(m[0].length) : text.slice(0, m.index)).trim();
  const amount = parseAmount(amountText, priceText);
  let perKg;
  if (unit === "kg") perKg = amount;
  else if (unit === "lb") perKg = amount / 0.45359237;
  else perKg = amount / (grams / 1000);
  if (!Number.isFinite(perKg) || perKg <= 0) fail("price", priceText);
  return { currency, perKg };
}

// ---------- formatMoney ----------

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail("amount", amount);
  if (typeof currency !== "string" || !Object.hasOwn(CURRENCIES, currency)) fail("currency", currency);
  if (typeof locale !== "string" || !Object.hasOwn(LOCALES, locale)) fail("locale", locale);
  const cur = CURRENCIES[currency];
  const loc = LOCALES[locale];
  const [ip, fp] = roundDecimalString(amount, cur.minor).split(".");
  const grouped = ip.replace(/\B(?=(\d{3})+(?!\d))/g, loc.group);
  const number = fp ? grouped + loc.decimal + fp : grouped;
  if (loc.symbolFirst) {
    return cur.symbol ? cur.symbol + number : currency + NBSP + number;
  }
  return number + NBSP + (cur.symbol ?? currency);
}

// ---------- kcalPer100g ----------

const ENERGY = /^(\d+(?:[.,]\d*)?|[.,]\d+)\s*(kcal|kj)\s*(?:\/|per)\s*(100\s*(?:g|grams?)|kg|kilograms?)$/i;

export function kcalPer100g(spec) {
  if (typeof spec !== "string") fail("energy spec", spec);
  const m = ENERGY.exec(spec.trim());
  if (!m) fail("energy spec", spec);
  let value = parseDecimal(m[1]);
  if (!Number.isFinite(value)) fail("energy spec", spec);
  if (m[2].toLowerCase() === "kj") value /= KCAL_KJ;
  if (/^k/i.test(m[3])) value /= 10;
  if (!Number.isFinite(value) || value < 50 || value > 900) fail("energy spec", spec);
  return value;
}

// ---------- daysSupply ----------

function massArgument(label, x) {
  if (typeof x === "number") {
    if (!Number.isFinite(x) || x <= 0) fail(label, x);
    return x;
  }
  if (typeof x === "string") return toGrams(x);
  fail(label, x);
}

function daysInMonth(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  const bag = massArgument("bag mass", bagGrams);
  const daily = massArgument("daily mass", dailyGrams);
  const days = Math.floor(bag / daily);
  if (!Number.isFinite(days) || days < 1) fail("days supply", `${show(bagGrams)} / ${show(dailyGrams)}`);
  if (typeof startISO !== "string") fail("start date", startISO);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startISO);
  if (!m) fail("start date", startISO);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) fail("start date", startISO);
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d + days - 1);
  if (Number.isNaN(t.getTime())) fail("start date", startISO);
  const yy = String(t.getUTCFullYear()).padStart(4, "0");
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// ---------- compare ----------

export function compare(products) {
  if (!Array.isArray(products)) fail("products", products);
  const valid = [];
  const invalid = [];
  for (const p of products) {
    const id = p !== null && typeof p === "object" ? p.id : undefined;
    try {
      if (p === null || typeof p !== "object") throw new TypeError("Invalid product");
      const { currency, perKg } = pricePerKg(p.price, p.mass);
      const rounded = Number(roundDecimalString(perKg, CURRENCIES[currency].minor));
      if (!Number.isFinite(rounded)) throw new TypeError("Invalid product");
      valid.push({ id, currency, perKg: rounded });
    } catch {
      invalid.push({ id, currency: null, perKg: NaN });
    }
  }
  valid.sort((a, b) => a.perKg - b.perKg);
  return [...valid, ...invalid];
}
