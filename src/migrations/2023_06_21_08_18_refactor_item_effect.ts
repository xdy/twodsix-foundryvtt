// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors, applyToAllItems } from "../module/utils/migration-utils";

async function refactorLinkedEffects (actor: TwodsixActor): Promise<void> {
  if (["traveller", "animal", "robot"].includes(actor.type)) {
    const itemEffects = actor.effects.filter(eff => eff.getFlag('twodsix', 'sourceId'));
    for (const effect of itemEffects) {
      const linkedItem = await fromUuid(effect.origin);
      if (linkedItem) {
        await linkedItem.effects.contents[0].update({"transfer": true, "disabled": (linkedItem.system.equipped !== "equipped"), "sourceLabel": linkedItem.name});
        await effect.delete();
      }
    }
  }
}
async function refactorLinkTransfer(item: TwodsixItem): Promise<void> {
  if (item.effects.size > 0) {
    if (!item.effects.contents[0].transfer) {
      await item.effects.contents[0].update({"transfer": true});
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorLinkedEffects);
  await applyToAllItems(refactorLinkTransfer);
  return Promise.resolve();
}
