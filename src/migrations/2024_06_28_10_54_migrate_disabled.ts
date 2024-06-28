// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { applyToAllActors } from "../module/utils/migration-utils";

async function resetDisabled(actor: TwodsixActor): Promise<void> {
  if (["traveller", "animal", "robot"].includes(actor.type)) {
    const applicableEffects = Array.from(actor.allApplicableEffects());
    for (const effect of applicableEffects) {
      if (effect.parent?.documentName === 'Item' && effect.disabled && effect.parent?.system.equipped !== 'equipped') {
        await effect.update({'disabled': false});
      }
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(resetDisabled);
  console.log("Disabled Migration Complete");
  return Promise.resolve();
}
