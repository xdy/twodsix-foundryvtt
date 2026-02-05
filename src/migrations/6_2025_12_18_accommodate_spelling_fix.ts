// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Migration: Fix misspelled component subtype "accomodations" → "accommodations"
 *
 * This migration corrects items across the world, actors, and compendium packs.
 * It leverages the built-in migration infrastructure and applyToAllItems utility.
 *
 */

import { applyToAllItems } from "../module/utils/migration-utils";

function migrateAccommodationSpelling(item: TwodsixItem): Record<string, any> | void {
  if (item.type === 'component' && item.system.subtype === 'accomodations') {
    return { 'system.subtype': 'accommodations' };
  }
}

export async function migrate(): Promise<void> {
  console.log("[TWODSIX] Starting accommodation spelling migration...");
  await applyToAllItems(migrateAccommodationSpelling, { batch: true });
  console.log("[TWODSIX] Accommodation spelling migration complete");
  return Promise.resolve();
}
