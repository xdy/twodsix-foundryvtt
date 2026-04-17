// CharGenPackResolver.js — Single source of truth for compendium pack resolution in chargen.
// All callers that need to find a compendium by ruleset + pack type delegate to this module.

import { getCharGenRegistryEntry } from './CharGenRegistry.js';

/** @type {Record<string, { packId: string, packFallbackId: string|null }>} */
const SPECIES_PACK_OVERRIDES = {};

/** Resolvable pack category. */
export const PackType = Object.freeze({
  ITEMS: 'items',
  TRAITS: 'traits',
  CAREERS: 'careers',
  SPECIES: 'species',
});

// ─── Last-resort hardcoded fallback pack IDs (only used when registry has no match) ───

const ITEMS_LAST_RESORT = 'twodsix.ce-srd-items';
const TRAITS_LAST_RESORT = 'twodsix.cepheus-deluxe-items';

// ─── Public API ──────────────────────────────────────────────────────────────────────

/**
 * Register a runtime override for species pack resolution (supersedes registry entries).
 * @param {string} rulesetKey
 * @param {{ packId: string, packFallbackId?: string|null }} packs
 */
export function registerSpeciesPackOverride(rulesetKey, packs) {
  if (!rulesetKey || typeof rulesetKey !== 'string' || !packs?.packId) {
    console.warn('twodsix | registerSpeciesPackOverride: invalid arguments', rulesetKey, packs);
    return;
  }
  SPECIES_PACK_OVERRIDES[String(rulesetKey).toUpperCase()] = {
    packId: packs.packId,
    packFallbackId: packs.packFallbackId ?? null,
  };
}

/**
 * Resolve pack IDs for a ruleset + pack type.
 * Chain: explicit pack ID -> explicit fallback -> itemPackId (careers/species/traits) -> itemPackFallbackId -> hardcoded last resort.
 *
 * @param {string} rulesetKey
 * @param {string} packType - One of {@link PackType} values
 * @returns {{ primaryId: string|null, fallbackId: string|null }}
 */
export function resolvePackIds(rulesetKey, packType) {
  const key = String(rulesetKey ?? '').toUpperCase();
  const entry = getCharGenRegistryEntry(key);
  const packs = entry?.packs ?? {};

  const directKey = `${packType}PackId`;
  const fallbackKey = `${packType}PackFallbackId`;

  let primaryId = packs[directKey] ?? null;
  let fallbackId = packs[fallbackKey] ?? null;

  // For CAREERS, SPECIES, and TRAITS: fall back to itemPackId / itemPackFallbackId
  if (packType !== PackType.ITEMS) {
    if (!primaryId) {
      primaryId = packs.itemPackId ?? null;
    }
    if (!fallbackId) {
      fallbackId = packs.itemPackFallbackId ?? null;
    }
    // Avoid setting fallback equal to primary (pointless)
    if (fallbackId === primaryId) {
      fallbackId = null;
    }
  }

  // Species-specific: check runtime overrides
  if (packType === PackType.SPECIES) {
    const override = SPECIES_PACK_OVERRIDES[key];
    if (override) {
      primaryId = override.packId;
      fallbackId = override.packFallbackId ?? fallbackId;
    }
  }

  // Hardcoded last resort
  if (!primaryId) {
    primaryId = packType === PackType.TRAITS ? TRAITS_LAST_RESORT : ITEMS_LAST_RESORT;
    fallbackId = null;
  }

  return { primaryId, fallbackId: fallbackId || null };
}

/**
 * Resolve a Foundry compendium for a ruleset + pack type.
 * Returns the first available compendium (primary > fallback), or null.
 *
 * @param {string} rulesetKey
 * @param {string} packType - One of {@link PackType} values
 * @returns {Compendium|null}
 */
export function resolvePack(rulesetKey, packType) {
  const { primaryId, fallbackId } = resolvePackIds(rulesetKey, packType);
  return (primaryId ? game.packs.get(primaryId) : null) || (fallbackId ? game.packs.get(fallbackId) : null) || null;
}

/**
 * Build a deduplicated ordered list of pack IDs to search for traits.
 * Chain: traitPackId -> itemPackId -> itemPackFallbackId -> traitPackFallbackId -> hardcoded last resort.
 *
 * @param {string} rulesetKey
 * @returns {string[]}
 */
export function resolveTraitPackChain(rulesetKey) {
  const key = String(rulesetKey ?? '').toUpperCase();
  const entry = getCharGenRegistryEntry(key);
  const packs = entry?.packs ?? {};
  const chain = [
    packs.traitPackId,
    packs.itemPackId,
    packs.itemPackFallbackId,
    packs.traitPackFallbackId ?? TRAITS_LAST_RESORT,
  ];
  const seen = new Set();
  const result = [];
  for (const id of chain) {
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Build a deduplicated ordered list of pack IDs to search for items (skills/weapons/gear).
 * Chain: itemPackId -> itemPackFallbackId -> hardcoded last resort.
 *
 * @param {string} rulesetKey
 * @returns {string[]}
 */
export function resolveItemPackChain(rulesetKey) {
  const key = String(rulesetKey ?? '').toUpperCase();
  const entry = getCharGenRegistryEntry(key);
  const packs = entry?.packs ?? {};
  const chain = [
    packs.itemPackId,
    packs.itemPackFallbackId,
    ITEMS_LAST_RESORT,
  ];
  const seen = new Set();
  const result = [];
  for (const id of chain) {
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Load documents from all available packs in a chain, merging results (later docs don't overwrite earlier ones).
 * Returns an empty array if no packs are available or all fail to load.
 *
 * @param {string[]} packIdChain - Ordered list of pack IDs to search
 * @returns {Promise<Array>} Merged array of all documents across the chain
 */
export async function loadDocumentsFromPackChain(packIdChain) {
  const allDocs = [];
  for (const packId of packIdChain) {
    const pack = game.packs.get(packId);
    if (!pack) {
      continue;
    }
    try {
      const docs = await pack.getDocuments();
      if (docs?.length) {
        allDocs.push(...docs);
      }
    } catch (e) {
      console.warn(`twodsix | Failed to load documents from pack "${packId}".`, e);
    }
  }
  return allDocs;
}
