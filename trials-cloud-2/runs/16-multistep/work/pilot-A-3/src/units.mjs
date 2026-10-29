// Unit helpers shared by the catalogue loader and the API.

export const KG_PER_LB = 0.45359; // PORTION-SPEC §1
export const LB_PER_KG = 1 / KG_PER_LB;

/** Pounds to kilograms. */
export function lbToKg(lb) {
  return lb * KG_PER_LB;
}

/** Kilograms to pounds. */
export function kgToLb(kg) {
  return kg / KG_PER_LB;
}

/** Metabolisable energy given per kilogram, expressed per 100 g. */
export function kcalPerKgTo100g(kcalPerKg) {
  return kcalPerKg / 10;
}

/** Metabolisable energy given per can/pouch of `packG` grams, expressed per 100 g. */
export function kcalPerPackTo100g(kcalPerPack, packG) {
  if (!(packG > 0)) throw new RangeError('packG must be positive');
  return (kcalPerPack / packG) * 100;
}

/**
 * Interpret the supplier feed's energy unit spelling (PORTION-SPEC §3).
 * Returns 'per100g' | 'perKg' | 'perPack', or undefined when it cannot be interpreted.
 * Tolerates capitals, extra whitespace and "per" instead of "/".
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const key = unit
    .toLowerCase()
    .replace(/\bper\b/g, '/')
    .replace(/\s+/g, '');
  if (/^kcal\/100g$/.test(key)) return 'per100g';
  if (/^kcal\/(kg|kilogram|kilo)$/.test(key)) return 'perKg';
  if (/^kcal\/(can|pouch|tin|pack|sachet)$/.test(key)) return 'perPack';
  return undefined;
}

/** Parse a numeric query value; returns NaN for anything that is not a finite number. */
export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
