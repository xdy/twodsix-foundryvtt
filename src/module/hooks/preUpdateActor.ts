// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { updateFinances } from "./updateFinances";
import { updateHits } from "./updateHits";

Hooks.on('preUpdateActor', (actor:TwodsixActor, update:Record<string, any>) => {
  updateHits(actor, update);
  updateFinances(actor, update);
});
