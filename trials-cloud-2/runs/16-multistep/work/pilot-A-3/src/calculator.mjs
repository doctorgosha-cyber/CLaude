// Turns a daily energy requirement and a product's energy density into grams per day.
import { dailyKcal, isGrowthStage } from './needs.mjs';

/** Safety cap as a share of body weight, grams per day per kg (PORTION-SPEC §5). */
export const CAP_SHARE = { cat: 0.025, dog: 0.03 };

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/**
 * Daily cap in grams for this animal and product, or undefined when no cap applies
 * (growth stages and wet products are never capped).
 */
export function capGrams({ species, weightKg, stage }, product) {
  if (product.form === 'wet' || isGrowthStage(species, stage)) return undefined;
  const share = CAP_SHARE[species];
  if (share === undefined) return undefined;
  return weightKg * 1000 * share;
}

/** Meals per day: growth stages eat 3, everything else 2 (PORTION-SPEC §6). */
export function mealsFor({ species, stage }) {
  return isGrowthStage(species, stage) ? 3 : 2;
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
  const meals = mealsFor({ species, stage });
  return { kcalPerDay, grams, capped, meals };
}
