// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";

Hooks.on('preUpdateOwnedItem', async (actor:TwodsixActor, oldItem: Record<string,any>, updateData: Record<string,any>) => {
  if (updateData.type && oldItem.system.useConsumableForAttack) {
    updateData["system.useConsumableForAttack"] = "";
  }
});

Hooks.on('updateItem', async (item: TwodsixItem, update: any) => {
  //Update item tab list if TL Changed
  if (game.settings.get('twodsix', 'showTLonItemsTab')) {
    if(["skills", "trait", "spell", "ship_position"].includes(item.type)) {
      return;
    } else if (item.isEmbedded || item.compendium) {
      return;
    } else if (update.system?.techLevel) {
      ui.items.render();
    }
  }
});
