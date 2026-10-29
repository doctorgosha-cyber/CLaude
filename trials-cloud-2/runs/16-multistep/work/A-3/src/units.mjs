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

/** Energy given per can/pouch of `packG` grams, expressed per 100 g. */
export function kcalPerPackTo100g(kcalPerPack, packG) {
  if (!(packG > 0)) throw new RangeError('packG must be positive');
  return (kcalPerPack / packG) * 100;
}

/**
 * Classify a hand-typed energy unit from the supplier feed (spec §3).
 * Returns 'per100g' | 'perKg' | 'perPack', or undefined when it cannot be interpreted.
 */
export function energyUnitKind(unit) {
  if (typeof unit !== 'string') return undefined;
  const u = unit.toLowerCase().replace(/\s*per\s*/g, '/').replace(/\s+/g, '');
  if (/^kcal\/100g$/.test(u)) return 'per100g';
  if (/^kcal\/kg$/.test(u)) return 'perKg';
  if (/^kcal\/(can|pouch)$/.test(u)) return 'perPack';
  return undefined;
}

/** Parse a numeric query value; returns NaN for anything that is not a finite number. */
export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
