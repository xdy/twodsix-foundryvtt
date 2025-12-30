// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Migration: Fix misspelled component subtype "accomodations" → "accommodations"
 *
 * This migration corrects items across the world, actors, and compendium packs.
 * It leverages the built-in migration infrastructure and applyToAllItems utility.
 *
 */

import { applyToAllActors } from "../module/utils/migration-utils";

async function migrateShipData(actor: TwodsixActor): Promise<void> {
  if (actor.type === 'ship') {
    const updates = {};
    const currentShowWeight:boolean = game.settings.get('twodsix', 'showWeightUsage');
    if (actor.system.showWeightUsage !== currentShowWeight) {
      foundry.utils.mergeObject(updates, {'system.showWeightUsage': currentShowWeight});
    }

    const currentMortgageTerm:boolean = parseFloat(game.settings.get('twodsix', 'mortgagePayment'));
    if (actor.system.financeValues.mortgagePaymentTerm !== currentMortgageTerm) {
      foundry.utils.mergeObject(updates, {'system.financeValues.mortgagePaymentTerm': currentMortgageTerm});
    }

    const currentMassProductionDiscount:number = parseFloat(game.settings.get('twodsix', 'massProductionDiscount'));
    if (actor.system.fianceValues.massProductionDiscount !== currentMassProductionDiscount) {
      foundry.utils.mergeObject(updates, {'system.financeValues.massProductionDiscount': currentMassProductionDiscount});
    }

    await actor.update(updates);
  }
}

export async function migrate(): Promise<void> {
  console.log("[TWODSIX] Starting accommodation ship data migration...");
  await applyToAllActors(migrateShipData);
  console.log("[TWODSIX] Ship data migration complete");
  return Promise.resolve();
}
