import TwodsixActor from "../entities/TwodsixActor";

Hooks.on('preUpdateOwnedItem', async (actor:TwodsixActor, oldItem: Record<string,any>, updateData: Record<string,any>) => {
  if (updateData.type && oldItem.data.useConsumableForAttack) {
    updateData["data.useConsumableForAttack"] = "";
  }
});
