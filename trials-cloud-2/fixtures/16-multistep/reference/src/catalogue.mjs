// Loads the product catalogue and normalises every product to kcal per 100 g (docs/PORTION-SPEC.md §3).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

/** Plausible energy density per form, kcal/100 g (spec §3, PS-402). */
export const ENERGY_RANGE = {
  dry: [250, 600],
  'semi-moist': [250, 600],
  wet: [60, 150],
};

/**
 * Canonical unit for a supplier spelling: 'kcal/100g', 'kcal/kg' or 'kcal/pack'.
 * The feed is hand-edited: trailing spaces, capitals, "per", "kcal / kg", "kcal/100 g" all occur.
 */
export function canonicalUnit(unit) {
  const u = String(unit ?? '').toLowerCase().replace(/\s+/g, '').replace(/per/g, '/');
  if (u === 'kcal/kg' || u === 'kcal/1kg' || u === 'kcal/1000g') return 'kcal/kg';
  if (u === 'kcal/100g' || u === 'kcal/100gr' || u === 'kcal/100grams') return 'kcal/100g';
  if (['kcal/can', 'kcal/pouch', 'kcal/tin', 'kcal/pack', 'kcal/tray'].includes(u)) return 'kcal/pack';
  throw new Error(`catalogue: unknown energy unit "${unit}"`);
}

/** Convert a product's declared energy to kcal per 100 g and validate it. */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const form = raw.form ?? 'dry';
  const packG = raw.pack_g;
  let kcalPer100g;
  switch (canonicalUnit(unit)) {
    case 'kcal/kg':
      kcalPer100g = kcalPerKgTo100g(value);
      break;
    case 'kcal/pack':
      if (!(packG > 0)) throw new Error(`catalogue: product ${raw.id} declares energy per pack but has no pack_g`);
      kcalPer100g = (value / packG) * 100;
      break;
    default:
      kcalPer100g = value;
  }
  const range = ENERGY_RANGE[form];
  if (!range) throw new Error(`catalogue: product ${raw.id} has unknown form "${form}"`);
  if (!(kcalPer100g >= range[0] && kcalPer100g <= range[1])) {
    throw new Error(
      `catalogue: product ${raw.id} (${form}) has ${kcalPer100g} kcal/100 g after normalisation ` +
        `(expected ${range[0]}-${range[1]}); check the unit in the feed`,
    );
  }
  return {
    id: raw.id,
    name: raw.name,
    species: raw.species,
    kcalPer100g,
    form,
    packG,
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
