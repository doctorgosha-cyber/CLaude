// Daily energy requirement (kcal/day) from species, body weight and life stage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTORS = JSON.parse(readFileSync(join(HERE, '..', 'data', 'factors.json'), 'utf8'));

export const SPECIES = Object.keys(FACTORS.stage);
export const ACTIVITIES = Object.keys(FACTORS.activity);
const DEFAULT_STAGE = 'adult';

export function stagesFor(species) {
  return Object.keys(FACTORS.stage[species] ?? {});
}

/** Map a client-facing stage key (current or legacy alias) to the current factor key. */
export function resolveStage(stage) {
  return FACTORS.aliases?.[stage] ?? stage;
}

/** True when `stage` (or its alias) exists for `species`. */
export function isValidStage(species, stage) {
  return Object.hasOwn(FACTORS.stage[species] ?? {}, resolveStage(stage));
}

/** Resting energy requirement: 70 * kg^0.75 (kcal/day). */
export function restingEnergy(weightKg) {
  return FACTORS.rer.coefficient * Math.pow(weightKg, FACTORS.rer.exponent);
}

function stageFactorFor(species, stage) {
  const table = FACTORS.stage[species];
  if (!table) throw new RangeError(`unknown species: ${species}`);
  // Legacy client keys are mapped via aliases; anything else is a client bug and is rejected.
  const key = resolveStage(stage);
  if (!Object.hasOwn(table, key)) throw new RangeError(`unknown stage for ${species}: ${stage}`);
  return table[key];
}

/**
 * Daily maintenance energy for an animal.
 * @param {{species:string, weightKg:number, stage?:string, activity?:string}} animal
 * @returns {number} kcal per day
 */
export function dailyKcal({ species, weightKg, stage = DEFAULT_STAGE, activity = 'normal' }) {
  const stageFactor = stageFactorFor(species, stage);
  const activityFactor = FACTORS.activity[activity];
  if (activityFactor === undefined) throw new RangeError(`unknown activity level: ${activity}`);
  if (!(weightKg > 0)) throw new RangeError('weightKg must be a positive number');
  return restingEnergy(weightKg) * stageFactor * activityFactor;
}
