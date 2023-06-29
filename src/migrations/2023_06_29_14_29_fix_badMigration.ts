// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors} from "../module/utils/migration-utils";

async function refactorLinkedEffects (actor: TwodsixActor): Promise<void> {
  if (["traveller", "animal", "robot"].includes(actor.type)) {
    if(!isNaN(actor.system.radiationProtection)) {
      actor.update({"system.radiationProtection": {value: 0}});
      console.log(`Updating ${actor.name}'s radiation protection`);
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorLinkedEffects);
  return Promise.resolve();
}
