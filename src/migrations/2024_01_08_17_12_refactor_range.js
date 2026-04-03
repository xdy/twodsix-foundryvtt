import { applyToAllActors, applyToAllItems } from '../module/utils/migration-utils';

export async function refactorRange(item) {
  if (item.type === 'weapon') {
    if (typeof item.system.range === 'number') {
      const newString = item.system.range === 0 ? "" : item.system.range.toString();
      await item.update({'system.range': newString});
    }
  }
}

async function refactorWeapons(actor) {
  for (const weapon of actor.itemTypes.weapon) {
    await refactorRange(weapon);
  }
}

export async function migrate() {
  await applyToAllItems(refactorRange);
  await applyToAllActors(refactorWeapons);
  console.log("Range Migration Complete");
  return Promise.resolve();
}
