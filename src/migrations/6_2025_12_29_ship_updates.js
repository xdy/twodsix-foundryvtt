
/**
 * Migration:
 * 1) Fix misspelled component subtype "accomodations" → "accommodations" for all world, compendium, and embedded ship items.
 * 2) Use camel case for j-drive and m-drive reqPower on ship actors.
 * 3) Update ship finance values and showWeightUsage from settings.
 *
 * This migration corrects:
 * - All world and compendium items (batch mode)
 * - All embedded items for ship actors (non-batched, with logging)
 * - All ship actors (batched)
 *
 * Logging is included for embedded item updates.
 *
 */

import { applyToAllActors } from "../module/utils/migration-utils";

function migrateShipData(actor) {
  if (actor.type === 'ship') {
    const updates = {};
    const currentShowWeight = game.settings.get('twodsix', 'showWeightUsage');
    if (actor.system.showWeightUsage !== currentShowWeight) {
      foundry.utils.mergeObject(updates, {'system.showWeightUsage': currentShowWeight});
    }

    const currentMortgageTerm = parseFloat(game.settings.get('twodsix', 'mortgagePayment'));
    if (actor.system.financeValues.mortgagePaymentTerm !== currentMortgageTerm) {
      foundry.utils.mergeObject(updates, {'system.financeValues.mortgagePaymentTerm': currentMortgageTerm});
    }

    const currentMassProductionDiscount = parseFloat(game.settings.get('twodsix', 'massProductionDiscount'));
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

export async function migrate() {
  console.log("[TWODSIX] Starting ship data migration...");
  await applyToAllActors(migrateShipData, { batch: true });
  console.log("[TWODSIX] Ship data migration complete");
  return Promise.resolve();
}
