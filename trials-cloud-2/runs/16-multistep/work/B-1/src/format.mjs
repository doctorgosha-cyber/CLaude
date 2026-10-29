// Rounding and response shaping.

/** Round half away from zero to `decimals` places. */
function roundHalfAway(value, decimals = 0) {
  const f = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * f)) / f;
}

/**
 * Portions are quoted in whole grams: round half away from zero to 1 g (spec §8).
 * No scoop sizes, no minimums — that is the app's job.
 */
export function roundGrams(grams) {
  return roundHalfAway(grams, 0);
}

/** Energy is quoted to one decimal. */
export function roundKcal(kcal) {
  return roundHalfAway(kcal, 1);
}

/** Cans/pouches are quoted to one decimal. */
export function roundCans(cans) {
  return roundHalfAway(cans, 1);
}

/** Shape the API response body (spec §9). */
export function formatPortion({ grams, kcalPerDay, weight, units, product, capped = false, meals = 2 }) {
  const roundedGrams = roundGrams(grams);
  const body = {
    grams: roundedGrams,
    kcalPerDay: roundKcal(kcalPerDay),
    weight,
    units,
    capped,
    meals,
    perMeal: roundGrams(roundedGrams / meals),
    product: {
      id: product.id,
      name: product.name,
      kcalPer100g: product.kcalPer100g,
    },
  };
  if (product.form === 'wet') body.cans = roundCans(roundedGrams / product.packG);
  return body;
}
