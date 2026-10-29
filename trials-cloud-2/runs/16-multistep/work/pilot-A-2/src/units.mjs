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

export const PER_100G = 'kcal/100g';
export const PER_KG = 'kcal/kg';

/**
 * Normalise the supplier feed's spelling of an energy unit ("kcal/kg ", "kcal per kg",
 * "KCAL / 100 G", ...) to PER_100G or PER_KG; undefined when it is neither.
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const key = unit.toLowerCase().replace(/\s+/g, '').replace(/per/g, '/');
  if (key === 'kcal/100g') return PER_100G;
  if (key === 'kcal/kg') return PER_KG;
  return undefined;
}

/** Parse a numeric query value; returns NaN for anything that is not a finite number. */
export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
