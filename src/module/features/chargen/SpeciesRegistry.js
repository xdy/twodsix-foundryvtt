// SpeciesRegistry.js — Loads species choices for chargen from per-ruleset compendium packs.
//
// Pack ids are resolved via {@link CharGenRegistry} entry's `packs.speciesPackId` / `speciesPackFallbackId`
// (with a `twodsix.<rulesetlower>-species` default). Modules can also call {@link registerSpeciesPack}
// from a hook listener to override at runtime.

import { getCharGenRegistryEntry } from './CharGenRegistry.js';

/** @type {Record<string, { packId: string, packFallbackId: string|null }>} */
const SPECIES_PACK_OVERRIDES = {};

/**
 * @typedef {Object} SpeciesChoice
 * @property {string} id - Compendium document id
 * @property {string} packId - Pack collection id the document was loaded from
 * @property {string} name - Display name
 * @property {string} img
 * @property {{ str: number, dex: number, end: number, int: number, edu: number, soc: number }} deltas
 * @property {string[]} grantedTraitNames
 * @property {string[]} abilityLines
 * @property {string[]} allowedCareers
 * @property {number} agingRollBonus
 * @property {string} homeworld
 * @property {object} chargenExtensions
 */

/**
 * Override the species compendium pack ids for a ruleset (e.g. from `Hooks.on('twodsix.registerCharGen', …)`).
 * @param {string} rulesetKey
 * @param {{ packId: string, packFallbackId?: string|null }} packs
 */
export function registerSpeciesPack(rulesetKey, packs) {
  if (!rulesetKey || typeof rulesetKey !== 'string' || !packs?.packId) {
    console.warn('twodsix | registerSpeciesPack: invalid arguments', rulesetKey, packs);
    return;
  }
  SPECIES_PACK_OVERRIDES[String(rulesetKey).toUpperCase()] = {
    packId: packs.packId,
    packFallbackId: packs.packFallbackId ?? null,
  };
}

/**
 * Resolve the species pack ids for a ruleset (override > registry entry > convention).
 * @param {string} rulesetKey
 * @returns {{ packId: string, packFallbackId: string|null }}
 */
function _resolveSpeciesPackIds(rulesetKey) {
  const key = String(rulesetKey ?? '').toUpperCase();
  const override = SPECIES_PACK_OVERRIDES[key];
  if (override) {
    return override;
  }
  const entry = getCharGenRegistryEntry(key);
  const packs = entry?.packs ?? {};
  return {
    packId: packs.speciesPackId ?? packs.itemPackId ?? `twodsix.${key.toLowerCase()}-srd-items`,
    packFallbackId: packs.speciesPackFallbackId ?? null,
  };
}

/**
 * Normalize a Foundry species `Item` document into a {@link SpeciesChoice}.
 * @param {Item} doc
 * @param {string} packId
 * @returns {SpeciesChoice|null}
 */
function _normalizeSpeciesDoc(doc, packId) {
  if (!doc || doc.type !== 'species') {
    return null;
  }
  const sys = doc.system ?? {};
  return {
    id: String(doc.id),
    packId,
    name: String(doc.name ?? ''),
    img: String(doc.img ?? ''),
    deltas: {
      str: Number(sys.deltas?.str) || 0,
      dex: Number(sys.deltas?.dex) || 0,
      end: Number(sys.deltas?.end) || 0,
      int: Number(sys.deltas?.int) || 0,
      edu: Number(sys.deltas?.edu) || 0,
      soc: Number(sys.deltas?.soc) || 0,
    },
    grantedTraitNames: Array.isArray(sys.grantedTraitNames)
      ? sys.grantedTraitNames.filter(Boolean)
      : [],
    abilityLines: Array.isArray(sys.abilityLines) ? sys.abilityLines.filter(Boolean) : [],
    allowedCareers: Array.isArray(sys.allowedCareers) ? sys.allowedCareers.filter(Boolean) : [],
    agingRollBonus: Number(sys.agingRollBonus) || 0,
    homeworld: String(sys.homeworld ?? ''),
    chargenExtensions: sys.chargenExtensions && typeof sys.chargenExtensions === 'object'
      ? sys.chargenExtensions
      : {},
  };
}

/**
 * Load species choices for a ruleset from its registered compendium pack (with fallback).
 * @param {string} rulesetKey
 * @returns {Promise<SpeciesChoice[]>}
 */
export async function loadSpeciesChoicesForRuleset(rulesetKey) {
  const { packId, packFallbackId } = _resolveSpeciesPackIds(rulesetKey);
  let pack = packId ? game.packs?.get(packId) : null;
  let resolvedPackId = packId;
  if (!pack && packFallbackId) {
    pack = game.packs.get(packFallbackId);
    resolvedPackId = packFallbackId;
  }
  if (!pack) {
    return [];
  }
  try {
    const docs = await pack.getDocuments();
    const choices = [];
    for (const doc of docs) {
      const c = _normalizeSpeciesDoc(doc, resolvedPackId);
      if (c) {
        choices.push(c);
      }
    }
    choices.sort((a, b) => a.name.localeCompare(b.name));
    return choices;
  } catch (err) {
    console.warn(`twodsix | Failed to load species pack "${resolvedPackId}".`, err);
    return [];
  }
}

/**
 * Look up one species choice by document id within the registered pack.
 * @param {string} rulesetKey
 * @param {string} speciesId
 * @returns {Promise<SpeciesChoice|null>}
 */
export async function getSpeciesChoiceById(rulesetKey, speciesId) {
  const choices = await loadSpeciesChoicesForRuleset(rulesetKey);
  return choices.find(c => c.id === speciesId) ?? null;
}
