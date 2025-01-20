// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { applyToAllItems, applyToAllActors } from "../module/utils/migration-utils";

async function refactorArmorPiercing(item: TwodsixItem): Promise<void> {
  if (foundry.utils.hasProperty(item.system, 'armorPiercing')) {
    if (typeof item.system.armorPiercing === 'number') {
      const newString = item.system.armorPiercing === 0 ? "0" : item.system.armorPiercing.toString();
      await item.update({'system.armorPiercing': newString});
    }
  }
}

async function refactorItems (actor:TwodsixActor): Promise<void> {
  for (const item of actor.items) {
    await refactorArmorPiercing(item);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorArmorPiercing);
  await applyToAllActors(refactorItems);
  console.log("Armor Piercing Migration Complete");
  return Promise.resolve();
}
