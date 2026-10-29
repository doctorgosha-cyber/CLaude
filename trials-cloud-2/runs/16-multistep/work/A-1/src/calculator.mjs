// Turns a daily energy requirement and a product's energy density into grams per day.
import { dailyKcal, isGrowthStage } from './needs.mjs';

/** Safety cap (spec §5): share of body weight per day for dry / semi-moist food. */
const CAP_SHARE = { cat: 0.025, dog: 0.03 };

/** Grams of product per day that deliver `kcalPerDay` at `kcalPer100g`. */
export function dailyGrams(kcalPerDay, kcalPer100g) {
  if (!(kcalPer100g > 0)) throw new RangeError('kcalPer100g must be positive');
  if (!(kcalPerDay >= 0)) throw new RangeError('kcalPerDay must be non-negative');
  return (kcalPerDay / kcalPer100g) * 100;
}

/**
 * Daily cap in grams for this animal on this product, or undefined when no cap applies
 * (wet products, growth stages).
 */
export function dailyCapGrams({ species, weightKg, stage }, product) {
  if (product.form === 'wet') return undefined;
  if (isGrowthStage(species, stage)) return undefined;
  const share = CAP_SHARE[species];
  if (share === undefined) return undefined;
  return weightKg * share * 1000;
}

/** Meals per day (spec §6): growth stages 3, everything else 2. */
export function mealsPerDay(species, stage) {
  return isGrowthStage(species, stage) ? 3 : 2;
}

/**
 * Full portion computation for one animal and one (normalised) product.
 * Returns unrounded numbers; see format.mjs for presentation.
 */
export function portionFor({ species, weightKg, stage, activity }, product) {
  const kcalPerDay = dailyKcal({ species, weightKg, stage, activity });
  const uncapped = dailyGrams(kcalPerDay, product.kcalPer100g);
  const cap = dailyCapGrams({ species, weightKg, stage }, product);
  const capped = cap !== undefined && uncapped > cap;
  const grams = capped ? cap : uncapped;
  return { kcalPerDay, grams, capped, meals: mealsPerDay(species, stage) };
}
