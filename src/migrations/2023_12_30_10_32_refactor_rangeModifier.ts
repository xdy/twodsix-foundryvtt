// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { applyToAllItems, applyToAllActors } from "../module/utils/migration-utils";

async function refactorMeleeRangeModifier(item: TwodsixItem): Promise<void> {
  if (item.type === 'weapon') {
    if (typeof item.system.meleeRangeModifier === 'number') {
      const newString = item.system.meleeRangeModifier.toString();
      item.update({'system.meleeRangeModifier': newString});
    }
  }
}

async function refactorWeapons (actor:TwodsixActor): Promise<void> {
  for (const weapon of actor.itemTypes.weapon) {
    refactorMeleeRangeModifier(weapon);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorMeleeRangeModifier);
  await applyToAllActors(refactorWeapons);
  console.log("Range Modifier Migration Complete");
  return Promise.resolve();
}
