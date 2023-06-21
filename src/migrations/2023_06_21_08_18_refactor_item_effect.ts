// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors } from "../module/utils/migration-utils";

async function refactorLinkedEffects (actor: TwodsixActor): Promise<void> {
  const itemEffects = actor.effects.filter(eff => eff.getFlag('twodsix', 'sourceId'));
  for (const effect of itemEffects) {
    const linkedItem = await fromUuid(effect.origin);
    if (linkedItem) {
      await linkedItem.effects.contents[0].update({"transfer": true, "disabled": !(linkedItem.system.equipped === "equipped"), "sourceLabel": linkedItem.name});
      effect.delete();
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorLinkedEffects);
  return Promise.resolve();
}
