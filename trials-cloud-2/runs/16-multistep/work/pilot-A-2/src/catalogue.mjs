// Loads the product catalogue and normalises every product to kcal per 100 g.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g, parseEnergyUnit, PER_KG } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

// PS-402: realistic dry/semi-moist foods are 250-600 kcal per 100 g (data/README.md);
// anything outside that after normalisation is a feed error and the catalogue is refused.
export const MIN_KCAL_PER_100G = 250;
export const MAX_KCAL_PER_100G = 600;

/**
 * Convert a product's declared energy to kcal per 100 g.
 * The supplier feed declares energy either per 100 g or per kg.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const parsedUnit = parseEnergyUnit(unit);
  if (!parsedUnit) throw new Error(`catalogue: product ${raw.id} has unknown energy unit ${JSON.stringify(unit)}`);
  const kcalPer100g = parsedUnit === PER_KG ? kcalPerKgTo100g(value) : value;
  if (!(kcalPer100g >= MIN_KCAL_PER_100G && kcalPer100g <= MAX_KCAL_PER_100G)) {
    throw new Error(
      `catalogue: product ${raw.id} has an implausible energy density of ${kcalPer100g} kcal/100g ` +
        `(expected ${MIN_KCAL_PER_100G}-${MAX_KCAL_PER_100G}); refusing to load (PS-402)`,
    );
  }
  return {
    id: raw.id,
    name: raw.name,
    species: raw.species,
    kcalPer100g,
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
