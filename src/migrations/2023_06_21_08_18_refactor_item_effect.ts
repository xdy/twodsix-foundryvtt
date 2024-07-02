// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors, applyToAllItems } from "../module/utils/migration-utils";

async function refactorLinkedEffects (actor: TwodsixActor): Promise<void> {
  if (["traveller", "animal", "robot"].includes(actor.type)) {
    const itemEffects = actor.effects.filter(eff => eff.getFlag('twodsix', 'sourceId'));
    for (const effect of itemEffects) {
      const linkedItem = await fromUuid(effect.origin);
      if (linkedItem) {
        await linkedItem.effects.contents[0].update({"transfer": game.settings.get('twodsix', 'useItemActiveEffects'), "disabled": false, "sourceLabel": linkedItem.name});
        await effect.delete();
      }
    }
    const woundedEffects = actor.effects.find(eff => eff.statuses.has('bleeding'));
    if (woundedEffects) {
      woundedEffects.update({"statuses": ['wounded']});
    }
  }
}
async function refactorItemTransfer(item: TwodsixItem): Promise<void> {
  if (item.effects.size > 0) {
    for (const effect of item.effects.contents) {
      if (effect.transfer !== game.settings.get('twodsix', 'useItemActiveEffects')) {
        await effect.update({"transfer": game.settings.get('twodsix', 'useItemActiveEffects')});
      }
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorLinkedEffects);
  await applyToAllItems(refactorItemTransfer);
  return Promise.resolve();
}
