// Daily energy requirement (kcal/day) from species, body weight and life stage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTORS = JSON.parse(readFileSync(join(HERE, '..', 'data', 'factors.json'), 'utf8'));

export const SPECIES = Object.keys(FACTORS.stage);
export const ACTIVITIES = Object.keys(FACTORS.activity);

export function stagesFor(species) {
  return Object.keys(FACTORS.stage[species] ?? {});
}

/** Resting energy requirement: 70 * kg^0.75 (kcal/day). */
export function restingEnergy(weightKg) {
  return FACTORS.rer.coefficient * Math.pow(weightKg, FACTORS.rer.exponent);
}

/**
 * Daily maintenance energy for an animal.
 * @param {{species:string, weightKg:number, stage?:string, activity?:string}} animal
 * @returns {number} kcal per day
 */
export function dailyKcal({ species, weightKg, stage = 'adult', activity = 'normal' }) {
  const stageTable = FACTORS.stage[species];
  if (!stageTable) throw new RangeError(`unknown species: ${species}`);
  const stageFactor = stageTable[stage];
  if (stageFactor === undefined) throw new RangeError(`unknown life stage for ${species}: ${stage}`);
  const activityFactor = FACTORS.activity[activity];
  if (activityFactor === undefined) throw new RangeError(`unknown activity level: ${activity}`);
  if (!(weightKg > 0)) throw new RangeError('weightKg must be a positive number');
  return restingEnergy(weightKg) * stageFactor * activityFactor;
}
