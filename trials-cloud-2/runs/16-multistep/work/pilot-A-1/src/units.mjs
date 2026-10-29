// Unit helpers shared by the catalogue loader and the API.

export const LB_PER_KG = 2.20462;

/** Pounds to kilograms. */
export function lbToKg(lb) {
  return lb / LB_PER_KG;
}

/** Kilograms to pounds. */
export function kgToLb(kg) {
  return kg * LB_PER_KG;
}

/** Metabolisable energy given per kilogram, expressed per 100 g. */
export function kcalPerKgTo100g(kcalPerKg) {
  return kcalPerKg / 10;
}

/** Parse a numeric query value; returns NaN for anything that is not a finite number. */
export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
