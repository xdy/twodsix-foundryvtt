import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import {Weapon} from "../../types/template";

Hooks.on('deleteOwnedItem', async (actor:TwodsixActor, itemData) => {
  if (itemData.type === "consumable") {
    //TODO Some risk of race condition here, should return list of updates to do, then do the update outside the loop
    actor.items.filter((item:TwodsixItem) => item.type !== "skills").forEach(async (item:TwodsixItem) => {
      const data = <Weapon>item.data.data;
      if (data.consumables.includes(itemData.id) || data.useConsumableForAttack === itemData.id) {
        await item.removeConsumable(itemData.id);
      }
    });
  }
});
