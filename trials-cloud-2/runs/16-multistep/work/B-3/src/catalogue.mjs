// Loads the product catalogue and normalises every product to kcal per 100 g.
// See docs/PORTION-SPEC.md section 3 for the unit spellings and plausibility rules.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { kcalPerKgTo100g } from './units.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CATALOGUE = join(HERE, '..', 'data', 'catalogue.json');

export const FORMS = ['dry', 'semi-moist', 'wet'];

/** Plausible energy density after normalisation (kcal per 100 g) by form (PS-402). */
export const PLAUSIBLE_KCAL_PER_100G = {
  dry: [250, 600],
  'semi-moist': [250, 600],
  wet: [60, 150],
};

/**
 * Interpret the feed's energy unit spelling. Returns 'per100g' | 'perKg' | 'perPack'
 * or undefined when the spelling cannot be interpreted.
 * The feed is hand-edited: capitals, extra spaces and "per" instead of "/" all occur.
 */
export function parseEnergyUnit(unit) {
  if (typeof unit !== 'string') return undefined;
  const u = unit.toLowerCase().replace(/\s+/g, ' ').trim().replace(/ ?per ?/g, '/').replace(/ ?\/ ?/g, '/');
  if (!u.startsWith('kcal/')) return undefined;
  const per = u.slice('kcal/'.length).replace(/\s+/g, '');
  if (per === '100g' || per === '100gram' || per === '100grams') return 'per100g';
  if (per === 'kg' || per === 'kilo' || per === 'kilogram') return 'perKg';
  if (per === 'can' || per === 'pouch' || per === 'tin') return 'perPack';
  return undefined;
}

/**
 * Convert a product's declared energy to kcal per 100 g.
 * Throws when the unit cannot be interpreted or a per-can product has no pack_g.
 */
export function normaliseProduct(raw) {
  const { value, unit } = raw.energy;
  const kind = parseEnergyUnit(unit);
  if (!kind) throw new Error(`catalogue: product ${raw.id} has an unknown energy unit "${unit}"`);
  let kcalPer100g;
  if (kind === 'per100g') kcalPer100g = value;
  else if (kind === 'perKg') kcalPer100g = kcalPerKgTo100g(value);
  else {
    if (!(raw.pack_g > 0)) {
      throw new Error(`catalogue: product ${raw.id} declares energy per can/pouch but has no pack_g`);
    }
    kcalPer100g = (value / raw.pack_g) * 100;
  }
  const form = raw.form ?? 'dry';
  if (!FORMS.includes(form)) throw new Error(`catalogue: product ${raw.id} has an unknown form "${form}"`);
  const [lo, hi] = PLAUSIBLE_KCAL_PER_100G[form];
  if (!(kcalPer100g >= lo && kcalPer100g <= hi)) {
    throw new Error(
      `catalogue: product ${raw.id} (${form}) normalises to ${kcalPer100g} kcal/100g, outside the plausible ${lo}-${hi}`,
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

/** Load and normalise the catalogue. Returns an array of products; throws on any bad product. */
export function loadCatalogue(file = DEFAULT_CATALOGUE) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(doc.products)) {
    throw new Error('catalogue: "products" must be an array');
  }
  const seen = new Set();
  const products = doc.products.map((raw) => {
    if (!raw.id || seen.has(raw.id)) throw new Error(`catalogue: duplicate or missing id ${raw.id}`);
    seen.add(raw.id);
    if (!raw.energy || typeof raw.energy.value !== 'number' || !(raw.energy.value > 0)) {
      throw new Error(`catalogue: product ${raw.id} has no positive numeric energy value`);
    }
    return normaliseProduct(raw);
  });
  return products;
}

/** Find a product by id in a loaded catalogue; undefined when absent. */
export function findProduct(products, id) {
  return products.find((p) => p.id === id);
}
