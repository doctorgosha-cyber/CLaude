// Rounding and response shaping (spec §7-9).

/** Portions are quoted in whole grams: round half away from zero to 1 g. */
export function roundGrams(grams) {
  return Math.sign(grams) * Math.round(Math.abs(grams));
}

/** Energy is quoted to one decimal. */
export function roundKcal(kcal) {
  return Math.round(kcal * 10) / 10;
}

/** One decimal, half away from zero. */
export function roundTenth(x) {
  return Math.sign(x) * Math.round(Math.abs(x) * 10) / 10;
}

/** Shape the API response body. */
export function formatPortion({ grams, kcalPerDay, weight, units, product, capped = false, meals = 2 }) {
  const g = roundGrams(grams);
  const body = {
    grams: g,
    kcalPerDay: roundKcal(kcalPerDay),
    weight,
    units,
    capped,
    meals,
    perMeal: roundGrams(g / meals),
    product: {
      id: product.id,
      name: product.name,
      kcalPer100g: product.kcalPer100g,
    },
  };
  if (product.form === 'wet' && product.packG > 0) body.cans = roundTenth(g / product.packG);
  return body;
}
