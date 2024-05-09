// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { updateFinances } from "./updateFinances";
import { updateHits } from "./updateHits";

Hooks.on('preUpdateActor', (actor:TwodsixActor, update:Record<string, any>) => {
  // Update Hits
  if (update?.system?.characteristics) {
    const charDiff = foundry.utils.diffObject(actor.system._source.characteristics, update.system.characteristics); //v12 stopped passing diffferential
    if (Object.keys(charDiff).length > 0) {
      updateHits(actor, update, charDiff);
    }
  }

  // Update Finances
  const financeDiff = {
    finances: update?.system?.finances ? foundry.utils.diffObject(actor.system._source.finances, update.system.finances) : {},
    financeValues: update?.system?.financeValues ? foundry.utils.diffObject(actor.system._source.financeValues, update.system.financeValues) : {} //v12 stopped passing diffferential
  };
  if (Object.keys(financeDiff.finances).length > 0 || Object.keys(financeDiff.financeValues).length > 0) {
    updateFinances(actor, update, financeDiff);
  }
});
