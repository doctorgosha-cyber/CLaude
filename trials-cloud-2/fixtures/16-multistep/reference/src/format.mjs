// Rounding and response shaping.

/** Portions are quoted in whole grams. */
export function roundGrams(grams) {
  return Math.round(grams);
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
