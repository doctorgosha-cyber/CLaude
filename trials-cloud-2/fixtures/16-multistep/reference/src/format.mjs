// Rounding and response shaping.

/**
 * Portions are quoted in whole grams: round half away from zero to 1 g.
 * (The app shows the number as-is; no scoop sizes, no minimums — that is the app's job.)
 */
export function roundGrams(grams) {
  return Math.sign(grams) * Math.round(Math.abs(grams));
}

/** Energy is quoted to one decimal. */
export function roundKcal(kcal) {
  return Math.round(kcal * 10) / 10;
}

/** Shape the API response body. */
export function formatPortion({ grams, kcalPerDay, weight, units, product }) {
  return {
    grams: roundGrams(grams),
    kcalPerDay: roundKcal(kcalPerDay),
    weight,
    units,
    product: {
      id: product.id,
      name: product.name,
      kcalPer100g: product.kcalPer100g,
    },
  };
}
