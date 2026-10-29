// Loads the product catalogue and normalises every product to kcal per 100 g.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g, kcalPerPackTo100g, parseEnergyUnit } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

export const FORMS = ['dry', 'semi-moist', 'wet'];

/** Plausible kcal per 100 g after normalisation, per form (PORTION-SPEC §3, PS-402). */
export const PLAUSIBLE_KCAL_PER_100G = {
  dry: { min: 250, max: 600 },
  'semi-moist': { min: 250, max: 600 },
  wet: { min: 60, max: 150 },
};

/**
 * Convert a product's declared energy to kcal per 100 g.
 * The supplier feed declares energy per 100 g, per kg, or per can/pouch (needs `pack_g`);
 * the spelling of the unit varies, so it is interpreted leniently. Throws on anything
 * that cannot be interpreted.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const kind = parseEnergyUnit(unit);
  let kcalPer100g;
  if (kind === 'per100g') kcalPer100g = value;
  else if (kind === 'perKg') kcalPer100g = kcalPerKgTo100g(value);
  else if (kind === 'perPack') {
    if (!(raw.pack_g > 0)) {
      throw new Error(`catalogue: product ${raw.id} declares energy "${unit}" but has no positive pack_g`);
    }
    kcalPer100g = kcalPerPackTo100g(value, raw.pack_g);
  } else {
    throw new Error(`catalogue: product ${raw.id} has an unknown energy unit "${unit}"`);
  }
  return {
    id: raw.id,
    name: raw.name,
    species: raw.species,
    kcalPer100g,
    form: raw.form ?? 'dry',
    packG: raw.pack_g,
    suitableFor: raw.suitable_for ?? [],
    added: raw.added,
  };
}

/** Throw unless the normalised product's energy density is plausible for its form. */
export function checkPlausible(product) {
  const range = PLAUSIBLE_KCAL_PER_100G[product.form];
  if (!range) throw new Error(`catalogue: product ${product.id} has an unknown form "${product.form}"`);
  const k = product.kcalPer100g;
  if (!(k >= range.min && k <= range.max)) {
    throw new Error(
      `catalogue: product ${product.id} (${product.form}) has ${k} kcal/100g, outside ${range.min}-${range.max}`,
    );
  }
  return product;
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
    return checkPlausible(normaliseProduct(raw));
  });
  return products;
}

/** Find a product by id in a loaded catalogue; undefined when absent. */
export function findProduct(products, id) {
  return products.find((p) => p.id === id);
}
