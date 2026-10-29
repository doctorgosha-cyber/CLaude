// Loads the product catalogue and normalises every product to kcal per 100 g.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g, kcalPerPackTo100g, energyUnitKind } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

/** Plausible kcal/100 g after normalisation, per form (spec §3, PS-402). */
const PLAUSIBLE = {
  dry: [250, 600],
  'semi-moist': [250, 600],
  wet: [60, 150],
};

/**
 * Convert a product's declared energy to kcal per 100 g.
 * The supplier feed declares energy per 100 g, per kg, or per can/pouch, with
 * inconsistent spelling; anything that cannot be interpreted is an error.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const kind = energyUnitKind(unit);
  let kcalPer100g;
  if (kind === 'per100g') kcalPer100g = value;
  else if (kind === 'perKg') kcalPer100g = kcalPerKgTo100g(value);
  else if (kind === 'perPack') {
    if (!(raw.pack_g > 0)) throw new Error(`catalogue: product ${raw.id} declares ${unit} but has no pack_g`);
    kcalPer100g = kcalPerPackTo100g(value, raw.pack_g);
  } else throw new Error(`catalogue: product ${raw.id} has an unrecognised energy unit "${unit}"`);

  const form = raw.form ?? 'dry';
  const range = PLAUSIBLE[form];
  if (!range) throw new Error(`catalogue: product ${raw.id} has unknown form "${form}"`);
  if (!(kcalPer100g >= range[0] && kcalPer100g <= range[1])) {
    throw new Error(
      `catalogue: product ${raw.id} (${form}) normalises to ${kcalPer100g} kcal/100g, outside ${range[0]}-${range[1]}`,
    );
  }
  return {
    id: raw.id,
    name: raw.name,
    species: raw.species,
    kcalPer100g,
    form,
    packG: raw.pack_g,
    suitableFor: raw.suitable_for ?? [],
    added: raw.added,
  };
}

/** Load and normalise the catalogue. Returns an array of products. */
export function loadCatalogue(file = DEFAULT_CATALOGUE) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(doc.products)) {
    throw new Error('catalogue: "products" must be an array');
  }
  const seen = new Set();
  const products = doc.products.map((raw) => {
    if (!raw.id || seen.has(raw.id)) throw new Error(`catalogue: duplicate or missing id ${raw.id}`);
    seen.add(raw.id);
    if (!raw.energy || typeof raw.energy.value !== 'number') {
      throw new Error(`catalogue: product ${raw.id} has no numeric energy value`);
    }
    return normaliseProduct(raw);
  });
  return products;
}

/** Find a product by id in a loaded catalogue; undefined when absent. */
export function findProduct(products, id) {
  return products.find((p) => p.id === id);
}
