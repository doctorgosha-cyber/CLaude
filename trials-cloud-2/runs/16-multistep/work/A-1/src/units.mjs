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
  if (!(packG > 0)) throw new RangeError('pack_g must be a positive number');
  return (kcalPerPack / packG) * 100;
}

/**
 * Interpret the supplier feed's energy unit spelling (hand edited: capitals, extra
 * spaces, "per" instead of "/"). Returns 'per100g' | 'perKg' | 'perPack', or undefined
 * when the unit cannot be interpreted.
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const norm = unit.toLowerCase().replace(/\s+/g, '').replace(/per/g, '/');
  const m = /^kcal\/(.+)$/.exec(norm);
  if (!m) return undefined;
  const denom = m[1];
  if (denom === '100g' || denom === '100gram' || denom === '100grams') return 'per100g';
  if (denom === 'kg' || denom === 'kilo' || denom === 'kilogram' || denom === '1kg' || denom === '1000g') return 'perKg';
  if (denom === 'can' || denom === 'pouch' || denom === 'tin' || denom === 'pack') return 'perPack';
  return undefined;
}

/** Parse a numeric query value; returns NaN for anything that is not a finite number. */
export function parseNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}
