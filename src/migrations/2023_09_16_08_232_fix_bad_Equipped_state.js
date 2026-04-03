import { applyToAllActors } from '../module/utils/migration-utils';

async function checkEquippedState(actor) {
  if (["traveller", "animal", "robot", "ship"].includes(actor.type)) {
    for (const item of actor.items) {
      await checkItemEquippedState(item);
    }
  }
}

async function checkItemEquippedState(item) {
  if (!["skills", "trait", "spell", "component", "ship_position", "psiAbility"].includes(item.type)) {
    if (typeof item.system.equipped !== "string") {
      await item.update({"system.equipped": "backpack"});
      console.log("Migrated " + item.name  + (item.actor ? " on " + item.actor.name : ""));
    }
  }
}

export async function migrate() {
  await applyToAllActors(checkEquippedState);
  const allItems = (game.items?.contents ?? []);
  for (const item of allItems) {
    await checkItemEquippedState(item);
  }
  console.log ("Equipped States Migrated");
  return Promise.resolve();
}
