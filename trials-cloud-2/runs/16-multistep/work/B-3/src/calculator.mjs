// Turns a daily energy requirement and a product's energy density into grams per day.
import { dailyKcal, isGrowthStage } from './needs.mjs';

/** Safety cap (spec section 5): share of body weight for dry / semi-moist food. */
export const CAP_SHARE = { cat: 0.025, dog: 0.03 };

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/** Daily cap in grams, or undefined when no cap applies (wet food, growth stages). */
export function capGrams({ species, weightKg, stage }, product) {
  if (product.form === 'wet') return undefined;
  if (isGrowthStage(species, stage)) return undefined;
  const share = CAP_SHARE[species];
  return share === undefined ? undefined : weightKg * 1000 * share;
}

/**
 * Full portion computation for one animal and one (normalised) product.
 * Returns unrounded numbers; see format.mjs for presentation.
 */
export function portionFor({ species, weightKg, stage, activity }, product) {
  const kcalPerDay = dailyKcal({ species, weightKg, stage, activity });
  const uncapped = dailyGrams(kcalPerDay, product.kcalPer100g);
  const cap = capGrams({ species, weightKg, stage }, product);
  const capped = cap !== undefined && uncapped > cap;
  const grams = capped ? cap : uncapped;
  const meals = isGrowthStage(species, stage) ? 3 : 2;
  return { kcalPerDay, grams, capped, meals };
}
