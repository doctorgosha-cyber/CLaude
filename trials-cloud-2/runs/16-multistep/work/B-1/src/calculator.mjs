// Turns a daily energy requirement and a product's energy density into grams per day.
import { dailyKcal, isGrowthStage } from './needs.mjs';

/** Spec §5: safety cap as a share of body weight, dry/semi-moist only, not for growth stages. */
export const CAP_SHARE = { cat: 0.025, dog: 0.03 };

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/** Daily cap in grams for this animal and product, or undefined when no cap applies. */
export function dailyCapGrams({ species, weightKg, stage }, product) {
  if (product.form === 'wet') return undefined;
  if (isGrowthStage(species, stage)) return undefined;
  const share = CAP_SHARE[species];
  return share === undefined ? undefined : weightKg * share * 1000;
}

/** Spec §6: growth stages eat 3 meals a day, every other stage 2. */
export function mealsPerDay({ species, stage }) {
  return isGrowthStage(species, stage) ? 3 : 2;
}

/**
 * Full portion computation for one animal and one (normalised) product.
 * Returns unrounded numbers; see format.mjs for presentation.
 */
export function portionFor({ species, weightKg, stage, activity }, product) {
  const kcalPerDay = dailyKcal({ species, weightKg, stage, activity });
  let grams = dailyGrams(kcalPerDay, product.kcalPer100g);
  const cap = dailyCapGrams({ species, weightKg, stage }, product);
  const capped = cap !== undefined && grams > cap;
  if (capped) grams = cap;
  return { kcalPerDay, grams, capped, meals: mealsPerDay({ species, stage }) };
}
