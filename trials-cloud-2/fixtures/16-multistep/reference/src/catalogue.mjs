// Loads the product catalogue and normalises every product to kcal per 100 g.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

export const MIN_KCAL_PER_100G = 250;
export const MAX_KCAL_PER_100G = 600;

/**
 * Canonical unit for a supplier spelling: 'kcal/kg' or 'kcal/100g'.
 * The feed is hand-edited: trailing spaces, capitals, "per", "kcal / kg", "kcal/100 g" all occur.
 */
export function canonicalUnit(unit) {
  const u = String(unit ?? '').toLowerCase().replace(/\s+/g, '').replace(/per/g, '/');
  if (u === 'kcal/kg' || u === 'kcal/1kg' || u === 'kcal/1000g') return 'kcal/kg';
  if (u === 'kcal/100g' || u === 'kcal/100gr' || u === 'kcal/100grams') return 'kcal/100g';
  throw new Error(`catalogue: unknown energy unit "${unit}"`);
}

/**
 * Convert a product's declared energy to kcal per 100 g.
 * The supplier feed declares energy either per 100 g or per kg.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const kcalPer100g = canonicalUnit(unit) === 'kcal/kg' ? kcalPerKgTo100g(value) : value;
  if (!(kcalPer100g >= MIN_KCAL_PER_100G && kcalPer100g <= MAX_KCAL_PER_100G)) {
    throw new Error(
      `catalogue: product ${raw.id} has ${kcalPer100g} kcal/100 g after normalisation ` +
        `(expected ${MIN_KCAL_PER_100G}-${MAX_KCAL_PER_100G}); check the unit in the feed`,
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
