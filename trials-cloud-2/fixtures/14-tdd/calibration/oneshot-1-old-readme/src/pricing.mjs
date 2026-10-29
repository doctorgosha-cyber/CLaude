// src/pricing.mjs — units & price helpers for the comparison tables (ES module, Node 22)

const OZ = 28.349523125;
const LB = 453.59237;

const UNIT_G = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: OZ, ounce: OZ, ounces: OZ,
  lb: LB, lbs: LB, pound: LB, pounds: LB,
};

const SYMBOLS = { "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₴": "UAH" };
const CODES = ["USD", "EUR", "GBP", "JPY", "CHF", "UAH"];
const MINOR = { USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, UAH: 2 };
const NARROW = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", UAH: "₴", CHF: null };
const LOCALES = {
  "en-US": { group: ",", decimal: ".", prefix: true },
  "de-DE": { group: ".", decimal: ",", prefix: false },
  "fr-FR": { group: " ", decimal: ",", prefix: false },
  "uk-UA": { group: " ", decimal: ",", prefix: false },
};

const MARK = "(?:[$€£¥₴]|USD|EUR|GBP|JPY|CHF|UAH)";
const PRICE_RE = new RegExp(
  `^(?:(${MARK})\\s*)?(\\d[\\d\\s.,]*?(?:[.,][-\\u2013\\u2014])?)(?:\\s*(${MARK}))?$`,
  "iu",
);
const NUM = "(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)";
const MASS_TOKEN_RE = new RegExp(`(${NUM})\\s*([a-z]+)\\s*`, "iy");
const COUNT_LEAD_RE = /^(\d+)\s*[×xX]\s*(.+)$/u;
const COUNT_TRAIL_RE = /^(.*?)\s*\(\s*(\d+)\s*\p{L}[\p{L}\s]*\)$/u;
const ENERGY_RE = new RegExp(`^(${NUM})\\s*(kcal|kj)\\s*(?:per|\\/)\\s*(100\\s*g|kg)$`, "iu");
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/u;

function describe(v) {
  try {
    if (typeof v === "string") return v;
    return String(v);
  } catch {
    return Object.prototype.toString.call(v);
  }
}

function fail(input) {
  throw new TypeError(`Invalid input: ${describe(input)}`);
}

function parseNum(s) {
  return Number(s.replace(",", "."));
}

// ---------------------------------------------------------------- toGrams

export function toGrams(spec) {
  if (typeof spec !== "string") fail(spec);
  let s = spec.trim();
  let count = 1;
  let m = COUNT_LEAD_RE.exec(s);
  if (m) {
    count = Number(m[1]);
    s = m[2].trim();
  } else if ((m = COUNT_TRAIL_RE.exec(s))) {
    count = Number(m[2]);
    s = m[1].trim();
  }
  if (s === "") fail(spec);

  let total = 0;
  let pos = 0;
  while (pos < s.length) {
    MASS_TOKEN_RE.lastIndex = pos;
    const t = MASS_TOKEN_RE.exec(s);
    if (!t) fail(spec);
    const factor = UNIT_G[t[2].toLowerCase()];
    if (factor === undefined) fail(spec);
    total += parseNum(t[1]) * factor;
    pos = MASS_TOKEN_RE.lastIndex;
  }
  const grams = total * count;
  if (!Number.isFinite(grams) || !(grams > 0)) fail(spec);
  return grams;
}

// ------------------------------------------------------------- pricePerKg

function parseAmount(raw) {
  let b = raw.replace(/\s+/gu, "").replace(/([.,])[-–—]$/u, "$100");
  const hasComma = b.includes(",");
  const hasDot = b.includes(".");
  let dec = null;
  if (hasComma && hasDot) {
    dec = b.lastIndexOf(",") > b.lastIndexOf(".") ? "," : ".";
    const thou = dec === "," ? "." : ",";
    b = b.split(thou).join("");
  } else if (hasComma || hasDot) {
    const ch = hasComma ? "," : ".";
    const occurrences = b.split(ch).length - 1;
    const after = b.slice(b.lastIndexOf(ch) + 1);
    if (occurrences > 1 || /^\d{3}$/u.test(after)) b = b.split(ch).join("");
    else dec = ch;
  }
  if (dec !== null) {
    if (b.split(dec).length !== 2) return NaN;
    b = b.replace(dec, ".");
  }
  if (!/^\d+(?:\.\d*)?$/u.test(b)) return NaN;
  return Number(b);
}

export function pricePerKg(priceText, massSpec) {
  if (typeof priceText !== "string") fail(priceText);
  const grams = toGrams(massSpec);
  const m = PRICE_RE.exec(priceText.trim());
  if (!m) fail(priceText);
  const before = m[1];
  const after = m[3];
  if ((before && after) || (!before && !after)) fail(priceText);
  const mark = before || after;
  const currency = SYMBOLS[mark] || mark.toUpperCase();
  if (!CODES.includes(currency)) fail(priceText);
  const amount = parseAmount(m[2]);
  if (!Number.isFinite(amount) || !(amount > 0)) fail(priceText);
  return { currency, perKg: amount / (grams / 1000) };
}

// ------------------------------------------------------------ formatMoney

function toPlainDecimal(n) {
  const s = String(n);
  const m = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/u.exec(s);
  if (!m) return s;
  const digits = m[1] + (m[2] || "");
  const exp = Number(m[3]) - (m[2] ? m[2].length : 0);
  if (exp >= 0) return digits + "0".repeat(exp);
  const pointPos = digits.length + exp;
  if (pointPos <= 0) return "0." + "0".repeat(-pointPos) + digits;
  return digits.slice(0, pointPos) + "." + digits.slice(pointPos);
}

function roundHalfEven(plain, minor) {
  let [int, frac = ""] = plain.split(".");
  if (frac.length <= minor) return { int, frac: frac.padEnd(minor, "0") };
  let keep = frac.slice(0, minor);
  const rest = frac.slice(minor);
  const first = rest[0];
  let up;
  if (first > "5") up = true;
  else if (first < "5") up = false;
  else if (/[1-9]/u.test(rest.slice(1))) up = true;
  else {
    const last = (keep || int).slice(-1);
    up = Number(last) % 2 === 1;
  }
  if (up) {
    const combined = (BigInt(int + keep) + 1n).toString().padStart(minor + 1, "0");
    int = combined.slice(0, combined.length - minor);
    keep = combined.slice(combined.length - minor);
  }
  return { int, frac: keep };
}

function groupDigits(int, sep) {
  return int.replace(/\B(?=(\d{3})+$)/gu, sep);
}

export function formatMoney(amount, currency, locale) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) fail(amount);
  if (typeof currency !== "string" || !CODES.includes(currency)) fail(currency);
  if (typeof locale !== "string" || !Object.hasOwn(LOCALES, locale)) fail(locale);

  const minor = MINOR[currency];
  const L = LOCALES[locale];
  const { int, frac } = roundHalfEven(toPlainDecimal(amount), minor);
  const num = groupDigits(int, L.group) + (minor > 0 ? L.decimal + frac : "");
  const sym = NARROW[currency];
  if (L.prefix) {
    return sym ? sym + num : currency + " " + num;
  }
  return num + " " + (sym || currency);
}

// ------------------------------------------------------------ kcalPer100g

export function kcalPer100g(spec) {
  if (typeof spec !== "string") fail(spec);
  const m = ENERGY_RE.exec(spec.trim());
  if (!m) fail(spec);
  let v = parseNum(m[1]);
  if (m[2].toLowerCase() === "kj") v = v / 4.184;
  if (m[3].toLowerCase() === "kg") v = v / 10;
  if (!Number.isFinite(v) || v < 50 || v > 900) fail(spec);
  return v;
}

// ------------------------------------------------------------- daysSupply

function pad(n, width) {
  return String(n).padStart(width, "0");
}

export function daysSupply(bagGrams, dailyGrams, startISO) {
  if (typeof bagGrams !== "number" || !Number.isFinite(bagGrams) || !(bagGrams > 0)) fail(bagGrams);
  if (typeof dailyGrams !== "number" || !Number.isFinite(dailyGrams) || !(dailyGrams > 0)) fail(dailyGrams);
  const days = Math.floor(bagGrams / dailyGrams);
  if (!(days >= 1)) fail(`${bagGrams} / ${dailyGrams}`);
  if (typeof startISO !== "string") fail(startISO);
  const m = DATE_RE.exec(startISO.trim());
  if (!m) fail(startISO);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    fail(startISO);
  }
  dt.setUTCDate(d + days - 1);
  if (Number.isNaN(dt.getTime())) fail(`${bagGrams} / ${dailyGrams}`);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1, 2)}-${pad(dt.getUTCDate(), 2)}`;
}

// ---------------------------------------------------------------- compare

export function compare(products) {
  if (!Array.isArray(products)) fail(products);
  const valid = [];
  const invalid = [];
  for (const p of products) {
    const item = p !== null && typeof p === "object" ? p : {};
    const id = item.id;
    try {
      const { currency, perKg } = pricePerKg(item.price, item.mass);
      valid.push({ id, currency, perKg });
    } catch (e) {
      if (!(e instanceof TypeError)) throw e;
      invalid.push({ id, currency: null, perKg: NaN });
    }
  }
  valid.sort((a, b) => a.perKg - b.perKg);
  return valid.concat(invalid);
}
