// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { updateFinances } from "./updateFinances";
import { updateHits } from "./updateHits";

Hooks.on('preUpdateActor', (actor:TwodsixActor, update:Record<string, any>) => {
  if (update?.system) {
    const systemDiff = foundry.utils.diffObject(actor.system._source, update.system); //v12 stopped passing difffernetial
    updateHits(actor, update, systemDiff);
    updateFinances(actor, update, systemDiff);
  }
});
