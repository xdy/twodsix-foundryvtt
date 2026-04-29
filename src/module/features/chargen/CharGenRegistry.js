// CharGenRegistry.js — Registry of rulesets that support character generation.
//
// This module uses class-instance dispatch pattern for character generation.
// Each ruleset has an associated logic class instance.
//
// To add a new ruleset:
//   1. Import its logic class here
//   2. Add an entry to CHARGEN_REGISTRY with the logic instance and needsPreload flag
//   3. If the ruleset uses career data preloading, set needsPreload: true; otherwise false

import { CDEECharGenLogic } from './CDEECharGenLogic.js';
import { CECharGenLogic } from './CECharGenLogic.js';
import { CUCharGenLogic } from './CUCharGenLogic.js';

// ─── CLASS INSTANCES (singletons) ───────────────────────────────────────────────

const ceLogic = new CECharGenLogic();
const cuLogic = new CUCharGenLogic();
const cdeeLogic = new CDEECharGenLogic();

// ─── REGISTRY ──────────────────────────────────────────────────────────────────

/**
 * Map of ruleset key -> chargen configuration.
 * @type {Record<string, { logic: BaseCharGenLogic, needsPreload: boolean }>}
 */
export const CHARGEN_REGISTRY = {
  CE: { logic: ceLogic, needsPreload: true },
  CU: { logic: cuLogic, needsPreload: false },
  CDEE: { logic: cdeeLogic, needsPreload: true },
};

/**
 * The set of ruleset keys that have chargen support.
 * Derived from the registry so there is a single source of truth.
 */
export const CHARGEN_SUPPORTED_RULESETS = new Set(Object.keys(CHARGEN_REGISTRY));

// ─── DISPATCH FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Get the character generation logic instance for a ruleset.
 * Unknown ruleset falls back to CE logic.
 * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CU')
 * @returns {BaseCharGenLogic} The logic instance
 */
export function getCharGenLogic(ruleset) {
  return (CHARGEN_REGISTRY[ruleset] ?? CHARGEN_REGISTRY.CE).logic;
}

/**
 * Dispatch character generation for the given ruleset.
 * Unknown ruleset falls back to CE.
 * @param {CharGenApp} app
 * @param {string} ruleset
 */
export async function dispatchCharGen(app, ruleset) {
  const logic = getCharGenLogic(ruleset);
  await logic.run(app);
}

/**
 * Pre-load career data for rulesets that need it before the UI starts.
 * Rulesets that defer loading (like CU) handle it inside their own run function.
 * @param {string} ruleset
 */
export async function preloadCharGenData(ruleset) {
  const entry = CHARGEN_REGISTRY[ruleset];
  if (entry?.needsPreload) {
    await entry.logic.loadData(ruleset);
  }
}
