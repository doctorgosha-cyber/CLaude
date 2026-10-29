// Pet-food calculator: evaluates a per-product formula from the JSON catalogue.
export function compileFormula(body) {
  const fn = new Function('weight', 'age', body);   // S5: dynamic code from catalogue data
  return (weight, age) => Number(fn(weight, age)) || 0;
}

export function kcalPerDay(weight) {
  return 70 * Math.pow(weight, 0.75);
}
