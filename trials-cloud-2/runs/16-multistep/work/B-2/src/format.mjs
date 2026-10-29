// Rounding and response shaping (spec §6-§9).

/** Round half away from zero to the given number of decimals. */
function roundHalfAway(value, decimals = 0) {
  const f = 10 ** decimals;
  // The tiny nudge keeps exact halves (e.g. 1.65 * 10 = 16.499999...) rounding away from zero.
  return (Math.sign(value) * Math.round(Math.abs(value) * f + 1e-9)) / f;
}

/**
 * Portions are quoted in whole grams: round half away from zero to 1 g.
 * (No scoop sizes, no minimums — the apps decide how to present small numbers.)
 */
export function roundGrams(grams) {
  return roundHalfAway(grams, 0);
}

/** Energy is quoted to one decimal. */
export function roundKcal(kcal) {
  return roundHalfAway(kcal, 1);
}

/** Cans are quoted to one decimal. */
export function roundCans(cans) {
  return roundHalfAway(cans, 1);
}

/** Shape the API response body. */
export function formatPortion({ grams, kcalPerDay, weight, units, product, capped = false, meals = 2 }) {
  const dailyGrams = roundGrams(grams);
  const body = {
    grams: dailyGrams,
    kcalPerDay: roundKcal(kcalPerDay),
    weight,
    units,
    capped,
    meals,
    perMeal: roundGrams(dailyGrams / meals),
    product: {
      id: product.id,
      name: product.name,
      kcalPer100g: product.kcalPer100g,
    },
  };
  if (product.form === 'wet') body.cans = roundCans(dailyGrams / product.packG);
  return body;
}
