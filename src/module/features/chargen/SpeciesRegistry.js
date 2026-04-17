// SpeciesRegistry.js — Loads species choices for chargen from per-ruleset compendium packs.
//
// Pack ids are resolved via {@link CharGenRegistry} entry's `packs.speciesPackId` / `speciesPackFallbackId`
// (with a `twodsix.<rulesetlower>-species` default). Modules can also call {@link registerSpeciesPack}
// from a hook listener to override at runtime.

import { PackType, registerSpeciesPackOverride, resolvePackIds } from './CharGenPackResolver.js';

/**
 * @typedef {Object} SpeciesChoice
 * @property {string} id - Compendium document id
 * @property {string} packId - Pack collection id the document was loaded from
 * @property {string} name - Display name
 * @property {string} img
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
  registerSpeciesPackOverride(rulesetKey, packs);
}

/**
 * Resolve the species pack ids for a ruleset (override > registry entry > convention).
 * @param {string} rulesetKey
 * @returns {{ packId: string, packFallbackId: string|null }}
 */
function _resolveSpeciesPackIds(rulesetKey) {
  return resolvePackIds(rulesetKey, PackType.SPECIES);
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
  const { primaryId, fallbackId } = _resolveSpeciesPackIds(rulesetKey);
  let pack = primaryId ? game.packs?.get(primaryId) : null;
  let resolvedPackId = primaryId;
  if (!pack && fallbackId) {
    pack = game.packs.get(fallbackId);
    resolvedPackId = fallbackId;
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
