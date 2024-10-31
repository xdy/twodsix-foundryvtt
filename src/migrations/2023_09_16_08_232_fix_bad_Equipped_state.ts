// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors} from "../module/utils/migration-utils";

async function checkEquippedState (actor: TwodsixActor): Promise<void> {
  if (["traveller", "animal", "robot", "ship"].includes(actor.type)) {
    for (const item of actor.items) {
      await checkItemEquippedState(item);
    }
  }
}

async function checkItemEquippedState (item:TwodsixItem): Promise<void> {
  if (!["skills", "trait", "spell", "component", "ship_position", "psiAbility"].includes(item.type)) {
    if (typeof item.system.equipped !== "string") {
      await item.update({"system.equipped": "backpack"});
      console.log("Migrated " + item.name  + (item.actor ? " on " + item.actor.name : ""));
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(checkEquippedState);
  const allItems = (game.items?.contents ?? []) as TwodsixItem[];
  for (const item of allItems) {
    await checkItemEquippedState(item);
  }
  console.log ("Equipped States Migrated");
  return Promise.resolve();
}
