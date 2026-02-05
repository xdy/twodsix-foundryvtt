// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Migration:
 * 1) Fix misspelled component subtype "accomodations" → "accommodations"
 * 2) Use camel case for j-drive and m-drive reqPower
 *
 * This migration corrects items across the world, actors, and compendium packs.
 * It leverages the built-in migration infrastructure and applyToAllActors utility.
 *
 */

import { applyToAllActors } from "../module/utils/migration-utils";

function migrateShipData(actor: TwodsixActor): Record<string, any> | void {
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
    if (actor.system.financeValues.massProductionDiscount !== currentMassProductionDiscount) {
      foundry.utils.mergeObject(updates, {'system.financeValues.massProductionDiscount': currentMassProductionDiscount});
    }

    // Normalize legacy reqPower keys from "m-drive"/"j-drive" to camelCase mDrive/jDrive
    if (actor.system.reqPower && typeof actor.system.reqPower === 'object') {
      const rp = actor.system.reqPower;
      let changed = false;
      const newReqPower = foundry.utils.deepClone(rp);
      if (foundry.utils.hasProperty(newReqPower, 'm-drive')) {
        newReqPower.mDrive = newReqPower['m-drive'];
        delete newReqPower['m-drive'];
        changed = true;
      }
      if (foundry.utils.hasProperty(newReqPower, 'j-drive')) {
        newReqPower.jDrive = newReqPower['j-drive'];
        delete newReqPower['j-drive'];
        changed = true;
      }
      if (changed) {
        foundry.utils.mergeObject(updates, {'system.reqPower': newReqPower});
      }
    }

    if (!foundry.utils.isEmpty(updates)) {
      return updates;
    }
  }
}

export async function migrate(): Promise<void> {
  console.log("[TWODSIX] Starting accommodation ship data migration...");
  await applyToAllActors(migrateShipData, { batch: true });
  console.log("[TWODSIX] Ship data migration complete");
  return Promise.resolve();
}
