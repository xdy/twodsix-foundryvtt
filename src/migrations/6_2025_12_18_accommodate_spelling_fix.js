
/**
 * Migration: Fix misspelled component subtype "accomodations" → "accommodations"
 *
 * This migration corrects items across the world, compendium packs, and also
 * all embedded items for ship actors. It leverages the built-in migration
 * infrastructure and applyToAllItems/applyToAllActors utilities.
 *
 * - All world and compendium items are processed in batch mode.
 * - All embedded items for ship actors are processed individually (non-batched).
 * - Logging is included for embedded item updates.
 */

import { applyToAllActors, applyToAllItems } from '../module/utils/migration-utils';

function migrateAccommodationSpelling(item) {
  if (item.type === 'component' && item.system.subtype === 'accomodations') {
    return { 'system.subtype': 'accommodations' };
  }
}

export async function migrate() {
  console.log("[TWODSIX] Starting accommodation spelling migration...");
  await applyToAllItems(migrateAccommodationSpelling, { batch: true });
  // Also process all embedded items for ship actors
  await applyToAllActors(async (actor) => {
    if (actor.type === 'ship') {
      for (const item of actor.items.contents) {
        const update = migrateAccommodationSpelling(item);
        if (update) {
          console.log("[TWODSIX] Updating embedded item:", item, "with", update);
          await item.update(update);
        }
      }
    }
  });
  console.log("[TWODSIX] Accommodation spelling migration complete");
  return Promise.resolve();
}
