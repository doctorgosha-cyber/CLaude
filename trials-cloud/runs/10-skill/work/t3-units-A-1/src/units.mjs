// Spec-sheet unit conversion for product comparison tables.
// International avoirdupois: 1 lb = 453.59237 g exactly, 1 oz = 1/16 lb.
const TO_GRAMS = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
const TO_ML = { ml: 1, l: 1000, 'fl oz': 29.5735, cup: 236.588 };

/** Parse "1.2 kg", "40oz", "1 lb 4 oz" into grams (rounded to 0.01 g). */
export function toGrams(spec) {
  const parts = [...String(spec).matchAll(/([\d.]+)\s*(kg|g|oz|lb)\b/g)];
  if (!parts.length) throw new TypeError(`cannot parse mass: ${spec}`);
  const g = parts.reduce((s, [, v, u]) => s + Number(v) * TO_GRAMS[u], 0);
  return Math.round(g * 100) / 100;
}

/** Parse "500 ml", "0.75 l", "16 fl oz" into millilitres (rounded to 0.1 ml). */
export function toMillilitres(spec) {
  const m = String(spec).match(/([\d.]+)\s*(ml|l|fl oz|cup)\b/);
  if (!m) throw new TypeError(`cannot parse volume: ${spec}`);
  return Math.round(Number(m[1]) * TO_ML[m[2]] * 10) / 10;
}

/** Celsius <-> Fahrenheit for thermos tests. */
export function cToF(c) { return c * 9 / 5 + 32; }
export function fToC(f) { return (f - 32) * 5 / 9; }
