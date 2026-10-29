// Rounding and response shaping.

/** Round to `decimals` places, half away from zero. */
function roundHalfAway(value, decimals = 0) {
  const f = 10 ** decimals;
  return (Math.sign(value) * Math.round(Math.abs(value) * f)) / f;
}

/**
 * Portions are quoted in whole grams: round half away from zero to 1 g.
 * (The app shows the number as-is; no scoop sizes, no minimums — that is the app's job.)
 */
export function roundGrams(grams) {
  return roundHalfAway(grams, 0);
}

/** Energy is quoted to one decimal. */
export function roundKcal(kcal) {
  return roundHalfAway(kcal, 1);
}

/** Shape the API response body. */
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
  if (product.form === 'wet' && product.packG > 0) {
    body.cans = roundHalfAway(roundedGrams / product.packG, 1);
  }
  return body;
}
