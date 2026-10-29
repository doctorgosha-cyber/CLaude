// Loads the product catalogue and normalises every product to kcal per 100 g.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

/** Plausible kcal per 100 g after normalisation, per form (spec §3, PS-402). */
export const PLAUSIBLE_RANGE = {
  dry: [250, 600],
  'semi-moist': [250, 600],
  wet: [60, 150],
};

/**
 * Interpret the feed's energy unit spelling (spec §3). The feed is hand-edited, so we
 * accept capitals, stray spaces and "per" instead of "/". Returns 'per100g', 'perKg',
 * 'perPack' (can or pouch) or undefined when the unit cannot be interpreted.
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const u = unit.toLowerCase().replace(/\bper\b/g, '/').replace(/\s+/g, '');
  const m = /^kcal\/(100g|kg|can|pouch)$/.exec(u);
  if (!m) return undefined;
  if (m[1] === '100g') return 'per100g';
  if (m[1] === 'kg') return 'perKg';
  return 'perPack';
}

/**
 * Convert a product's declared energy to kcal per 100 g and check it is plausible.
 * Throws when the unit cannot be interpreted, a per-can product has no pack_g, the form is
 * unknown, or the normalised energy is outside the plausible range for the form.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const kind = parseEnergyUnit(unit);
  if (!kind) throw new Error(`catalogue: product ${raw.id} has an uninterpretable energy unit "${unit}"`);

  let kcalPer100g;
  if (kind === 'per100g') {
    kcalPer100g = value;
  } else if (kind === 'perKg') {
    kcalPer100g = kcalPerKgTo100g(value);
  } else {
    if (!(raw.pack_g > 0)) {
      throw new Error(`catalogue: product ${raw.id} declares energy per can/pouch but has no pack_g`);
    }
    kcalPer100g = (value / raw.pack_g) * 100;
  }

  const form = raw.form ?? 'dry';
  const range = PLAUSIBLE_RANGE[form];
  if (!range) throw new Error(`catalogue: product ${raw.id} has an unknown form "${form}"`);
  const [min, max] = range;
  if (!(kcalPer100g >= min && kcalPer100g <= max)) {
    throw new Error(
      `catalogue: product ${raw.id} (${form}) normalises to ${kcalPer100g} kcal/100g, outside ${min}-${max}`,
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

/** Load and normalise the catalogue. Returns an array of products; throws on a bad feed. */
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
