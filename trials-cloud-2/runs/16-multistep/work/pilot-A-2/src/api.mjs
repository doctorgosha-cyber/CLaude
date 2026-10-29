// HTTP-less request handler for GET /portion. Takes the query (string, URLSearchParams
// or plain object) and returns { status, body }. The server wrapper is out of scope here.
import { loadCatalogue, findProduct } from './catalogue.mjs';
import { SPECIES, ACTIVITIES, isValidStage, stagesFor } from './needs.mjs';
import { portionFor } from './calculator.mjs';
import { formatPortion } from './format.mjs';
import { parseNumber, lbToKg } from './units.mjs';

const UNITS = ['metric', 'imperial'];

let catalogue;
function getCatalogue() {
  if (!catalogue) catalogue = loadCatalogue();
  return catalogue;
}

/** For tests: drop the cached catalogue so the next request reloads it. */
export function resetCatalogue() {
  catalogue = undefined;
}

function toParams(input) {
  if (input instanceof URLSearchParams) return input;
  if (typeof input === 'string') {
    const q = input.includes('?') ? input.slice(input.indexOf('?') + 1) : input;
    return new URLSearchParams(q);
  }
  return new URLSearchParams(Object.entries(input ?? {}).map(([k, v]) => [k, String(v)]));
}

function error(status, message) {
  return { status, body: { error: message } };
}

/**
 * Handle one portion request.
 * Query parameters: species (cat|dog), weight (number), units (metric|imperial, default metric),
 * stage (life stage key, default adult), activity (low|normal|high, default normal), product (catalogue id).
 */
export function handlePortion(input) {
  const q = toParams(input);

  const species = q.get('species');
  if (!SPECIES.includes(species)) return error(400, `species must be one of ${SPECIES.join(', ')}`);

  const units = q.get('units') ?? 'metric';
  if (!UNITS.includes(units)) return error(400, `units must be one of ${UNITS.join(', ')}`);

  const weight = parseNumber(q.get('weight'));
  if (!(weight > 0)) return error(400, 'weight is required and must be a positive number');

  const stage = q.get('stage') ?? 'adult';
  if (!isValidStage(species, stage)) {
    return error(400, `stage must be one of ${stagesFor(species).join(', ')}`);
  }

  const activity = q.get('activity') ?? 'normal';
  if (!ACTIVITIES.includes(activity)) return error(400, `activity must be one of ${ACTIVITIES.join(', ')}`);

  const productId = q.get('product');
  if (!productId) return error(400, 'product is required');
  const product = findProduct(getCatalogue(), productId);
  if (!product) return error(404, `unknown product: ${productId}`);
  if (product.species !== species) return error(400, `product ${productId} is not a ${species} food`);

  // Imperial clients send the weight in pounds; the needs model works in kilograms.
  const weightKg = units === 'imperial' ? lbToKg(weight) : weight;
  const { kcalPerDay, grams } = portionFor({ species, weightKg, stage, activity }, product);
  return {
    status: 200,
    body: formatPortion({ grams, kcalPerDay, weight, units, product }),
  };
}
