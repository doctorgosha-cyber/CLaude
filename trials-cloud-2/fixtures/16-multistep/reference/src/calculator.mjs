// Turns a daily energy requirement and a product's energy density into grams per day (spec §4-6).
import { dailyKcal, isGrowthStage } from './needs.mjs';

/** Daily safety cap as a share of body weight, by species (spec §5). */
export const CAP_SHARE = { cat: 0.025, dog: 0.03 };

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/**
 * Full portion computation for one animal and one (normalised) product.
 * Returns unrounded grams plus cap and meal information; see format.mjs for presentation.
 */
export function portionFor({ species, weightKg, stage, activity }, product) {
  const kcalPerDay = dailyKcal({ species, weightKg, stage, activity });
  let grams = dailyGrams(kcalPerDay, product.kcalPer100g);
  const growth = isGrowthStage(species, stage);
  let capped = false;
  if (!growth && product.form !== 'wet') {
    const cap = weightKg * CAP_SHARE[species] * 1000;
    if (grams > cap) {
      grams = cap;
      capped = true;
    }
  }
  const meals = growth ? 3 : 2;
  return { kcalPerDay, grams, capped, meals };
}
