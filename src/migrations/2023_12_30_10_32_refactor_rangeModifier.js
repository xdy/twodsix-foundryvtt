import { applyToAllActors, applyToAllItems } from '../module/utils/migration-utils';

async function refactorMeleeRangeModifier(item) {
  if (item.type === 'weapon') {
    if (typeof item.system.meleeRangeModifier === 'number') {
      const newString = item.system.meleeRangeModifier.toString();
      item.update({'system.meleeRangeModifier': newString});
    }
  }
}

async function refactorWeapons(actor) {
  for (const weapon of actor.itemTypes.weapon) {
    refactorMeleeRangeModifier(weapon);
  }
}

export async function migrate() {
  await applyToAllItems(refactorMeleeRangeModifier);
  await applyToAllActors(refactorWeapons);
  console.log("Range Modifier Migration Complete");
  return Promise.resolve();
}
