// Turns a daily energy requirement and a product's energy density into grams per day.
import { dailyKcal, isGrowthStage } from './needs.mjs';

/** Safety cap (spec §5): share of body weight a dry/semi-moist daily portion may not exceed. */
export const CAP_SHARE = { cat: 0.025, dog: 0.03 };

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/** Maximum daily grams for the species at this weight (grams per day). */
export function portionCap(species, weightKg) {
  const share = CAP_SHARE[species];
  if (share === undefined) throw new RangeError(`unknown species: ${species}`);
  return weightKg * 1000 * share;
}

/**
 * Full portion computation for one animal and one (normalised) product.
 * Returns unrounded numbers plus `capped` and `meals`; see format.mjs for presentation.
 */
export function portionFor({ species, weightKg, stage, activity }, product) {
  const kcalPerDay = dailyKcal({ species, weightKg, stage, activity });
  const needGrams = dailyGrams(kcalPerDay, product.kcalPer100g);
  const growth = isGrowthStage(species, stage);
  const capApplies = product.form !== 'wet' && !growth;
  const cap = capApplies ? portionCap(species, weightKg) : Infinity;
  const capped = needGrams > cap;
  return {
    kcalPerDay,
    grams: capped ? cap : needGrams,
    capped,
    meals: growth ? 3 : 2,
  };
}
