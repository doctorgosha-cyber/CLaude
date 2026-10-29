// Daily energy requirement (kcal/day) from species, body weight and life stage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FACTORS = JSON.parse(readFileSync(join(HERE, '..', 'data', 'factors.json'), 'utf8'));

export const SPECIES = Object.keys(FACTORS.stage);
export const ACTIVITIES = Object.keys(FACTORS.activity);
const DEFAULT_STAGE = 'adult';
const ALIASES = FACTORS.aliases ?? {};

/** Growth stages (spec §5, §6): fed 3 meals a day and exempt from the safety cap. */
export const GROWTH_STAGES = new Set(['kitten', 'puppy']);

export function stagesFor(species) {
  return Object.keys(FACTORS.stage[species] ?? {});
}

/**
 * Resolve a client stage label to the current factor key for the species. Legacy aliases
 * from factors.json are accepted; anything else is undefined (the service never guesses).
 */
export function resolveStage(species, stage) {
  const table = FACTORS.stage[species];
  if (!table || typeof stage !== 'string') return undefined;
  const key = Object.hasOwn(ALIASES, stage) ? ALIASES[stage] : stage;
  return Object.hasOwn(table, key) ? key : undefined;
}

/** True when the (possibly aliased) stage is a growth stage for the species. */
export function isGrowthStage(species, stage) {
  const key = resolveStage(species, stage);
  return key !== undefined && GROWTH_STAGES.has(key);
}

/** Resting energy requirement: 70 * kg^0.75 (kcal/day). */
export function restingEnergy(weightKg) {
  return FACTORS.rer.coefficient * Math.pow(weightKg, FACTORS.rer.exponent);
}

function stageFactorFor(species, stage) {
  const table = FACTORS.stage[species];
  if (!table) throw new RangeError(`unknown species: ${species}`);
  const key = resolveStage(species, stage);
  if (key === undefined) throw new RangeError(`unknown stage for ${species}: ${stage}`);
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
