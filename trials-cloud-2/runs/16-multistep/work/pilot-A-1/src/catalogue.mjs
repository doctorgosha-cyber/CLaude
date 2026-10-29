// Loads the product catalogue and normalises every product to kcal per 100 g.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

/** Plausible energy density for a complete pet food, kcal per 100 g (inclusive). */
export const MIN_KCAL_PER_100G = 250;
export const MAX_KCAL_PER_100G = 600;

/**
 * Classify a supplier unit spelling as 'per100g' or 'perKg'.
 * The feed is hand-edited: case, surrounding/inner whitespace and "per" vs "/" all vary
 * ("kcal/kg", "kcal/kg ", "Kcal per KG", "kcal/100 g", "kcal per 100g", ...).
 * Returns undefined for anything that is not recognisably one of the two.
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const key = unit.toLowerCase().replace(/\s+/g, '').replace(/per/g, '/');
  if (key === 'kcal/100g') return 'per100g';
  if (key === 'kcal/kg' || key === 'kcal/1000g') return 'perKg';
  return undefined;
}

/**
 * Convert a product's declared energy to kcal per 100 g.
 * The supplier feed declares energy either per 100 g or per kg.
 * Throws when the unit is not recognised or the result is outside the plausible range.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const kind = parseEnergyUnit(unit);
  if (!kind) throw new Error(`catalogue: product ${raw.id} has unknown energy unit ${JSON.stringify(unit)}`);
  const kcalPer100g = kind === 'perKg' ? kcalPerKgTo100g(value) : value;
  if (!(kcalPer100g >= MIN_KCAL_PER_100G && kcalPer100g <= MAX_KCAL_PER_100G)) {
    throw new Error(
      `catalogue: product ${raw.id} normalises to ${kcalPer100g} kcal/100g, ` +
        `outside ${MIN_KCAL_PER_100G}-${MAX_KCAL_PER_100G} (declared ${value} ${JSON.stringify(unit)})`,
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
    if (!raw.energy || typeof raw.energy.value !== 'number' || !Number.isFinite(raw.energy.value)) {
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
