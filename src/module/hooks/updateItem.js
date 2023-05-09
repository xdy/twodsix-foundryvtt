Hooks.on('preUpdateOwnedItem', async (actor, oldItem, updateData) => {
  if (updateData.type && oldItem.system.useConsumableForAttack) {
    updateData["system.useConsumableForAttack"] = "";
  }
});
export {};
