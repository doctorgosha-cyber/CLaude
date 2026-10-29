// Unit helpers shared by the catalogue loader and the API.

/** Spec §1: 1 lb = 0.45359 kg. */
export const KG_PER_LB = 0.45359;
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

/** Energy given per can/pouch of `packG` grams, expressed per 100 g. */
export function kcalPerPackTo100g(kcalPerPack, packG) {
  if (!(packG > 0)) throw new RangeError('pack_g must be a positive number');
  return (kcalPerPack / packG) * 100;
}

/**
 * Interpret the supplier feed's energy unit spelling (spec §3). Returns
 * 'per100g' | 'perKg' | 'perPack', or undefined when it cannot be interpreted.
 * Tolerates capitals, extra spaces and "per" instead of "/".
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const u = unit
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*per\s+/g, '/')
    .replace(/\s*\/\s*/g, '/')
    .replace(/(\d)\s*g\b/g, '$1g');
  const m = /^kcal\/(100g|kg|can|pouch)$/.exec(u);
  if (!m) return undefined;
  if (m[1] === '100g') return 'per100g';
  if (m[1] === 'kg') return 'perKg';
  return 'perPack';
}

/** Parse a numeric query value; returns NaN for anything that is not a finite number. */
export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
