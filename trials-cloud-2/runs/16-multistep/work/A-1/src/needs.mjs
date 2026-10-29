// Daily energy requirement (kcal/day) from species, body weight and life stage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTORS = JSON.parse(readFileSync(join(HERE, '..', 'data', 'factors.json'), 'utf8'));

export const SPECIES = Object.keys(FACTORS.stage);
export const ACTIVITIES = Object.keys(FACTORS.activity);
const ALIASES = FACTORS.aliases ?? {};
const GROWTH_STAGES = new Set(['kitten', 'puppy']);
const DEFAULT_STAGE = 'adult';

export function stagesFor(species) {
  return Object.keys(FACTORS.stage[species] ?? {});
}

/**
 * Resolve a client-facing stage label (current key or legacy alias) to the current key
 * for that species; undefined when the label is not known. Never guesses.
 */
export function resolveStage(species, stage) {
  const table = FACTORS.stage[species];
  if (!table) return undefined;
  const key = Object.hasOwn(table, stage) ? stage : ALIASES[stage];
  return key !== undefined && Object.hasOwn(table, key) ? key : undefined;
}

/** True for growth stages (kitten, puppy and their aliases). */
export function isGrowthStage(species, stage) {
  return GROWTH_STAGES.has(resolveStage(species, stage));
}

/** Resting energy requirement: 70 * kg^0.75 (kcal/day). */
export function restingEnergy(weightKg) {
  return FACTORS.rer.coefficient * Math.pow(weightKg, FACTORS.rer.exponent);
}

function stageFactorFor(species, stage) {
  if (!FACTORS.stage[species]) throw new RangeError(`unknown species: ${species}`);
  const key = resolveStage(species, stage);
  if (key === undefined) throw new RangeError(`unknown stage for ${species}: ${stage}`);
  return FACTORS.stage[species][key];
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
