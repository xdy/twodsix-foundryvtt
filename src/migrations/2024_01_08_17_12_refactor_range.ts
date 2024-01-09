// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { applyToAllItems, applyToAllActors } from "../module/utils/migration-utils";

export async function refactorRange(item: TwodsixItem): Promise<void> {
  if (item.type === 'weapon') {
    if (typeof item.system.range === 'number') {
      const newString = item.system.range === 0 ? "" : item.system.range.toString();
      await item.update({'system.range': newString});
    }
  }
}

async function refactorWeapons (actor:TwodsixActor): Promise<void> {
  for (const weapon of actor.itemTypes.weapon) {
    await refactorRange(weapon);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorRange);
  await applyToAllActors(refactorWeapons);
  console.log("Range Migration Complete");
  return Promise.resolve();
}
