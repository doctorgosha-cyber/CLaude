// Turns a daily energy requirement and a product's energy density into grams per day.
import { dailyKcal } from './needs.mjs';

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/**
 * Full portion computation for one animal and one (normalised) product.
 * Returns unrounded numbers; see format.mjs for presentation.
 */
export function portionFor({ species, weightKg, stage, activity }, product) {
  const kcalPerDay = dailyKcal({ species, weightKg, stage, activity });
  const grams = dailyGrams(kcalPerDay, product.kcalPer100g);
  return { kcalPerDay, grams };
}
