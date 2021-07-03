import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";

Hooks.on('deleteOwnedItem', async (actor:TwodsixActor, itemData) => {
  if (itemData.type === "consumable") {
    actor.items.filter((item:TwodsixItem) => item.type !== "skills").forEach(async (item:TwodsixItem) => {
      if (item.data.data.consumables.includes(itemData._id) || item.data.data.useConsumableForAttack === itemData._id) {
        await item.removeConsumable(itemData._id);
      }
    });
  }
});
