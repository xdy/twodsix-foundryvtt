import { applyToAllActors, applyToAllItems } from '../module/utils/migration-utils';

async function refactorArmorPiercing(item) {
  if (foundry.utils.hasProperty(item.system, 'armorPiercing')) {
    if (typeof item.system.armorPiercing === 'number') {
      const newString = item.system.armorPiercing === 0 ? "0" : item.system.armorPiercing.toString();
      await item.update({'system.armorPiercing': newString});
    }
  }
}

async function refactorItems(actor) {
  for (const item of actor.items) {
    await refactorArmorPiercing(item);
  }
}

export async function migrate() {
  await applyToAllItems(refactorArmorPiercing);
  await applyToAllActors(refactorItems);
  console.log("Armor Piercing Migration Complete");
  return Promise.resolve();
}
