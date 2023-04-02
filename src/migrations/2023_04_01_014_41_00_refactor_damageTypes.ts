// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllItems } from "../module/utils/migration-utils";

async function refactorDamageTypes (item: TwodsixItem): Promise<void> {
  if (["weapon", "armor", "consumable"].includes(item.type)) {
    const damageTypeList = getDamageTypes();
    if (["weapon", "consumable"].includes(item.type)){
      const damageTypeLC  = item.system.damageType.toLowerCase();
      item.update({"system.damageType": Object.hasOwn(damageTypeList, damageTypeLC) ? damageTypeLC : "None"});
    } else if (item.type === "armor" && !Array.isArray(item.system.secondaryArmor.protectionTypes)) {
      const protectionArray = [];
      let protectionTypes = game.settings.get('twodsix', 'damageTypeOptions').split(',');
      protectionTypes = protectionTypes.map(s => s.trim());
      for (const protType of protectionTypes) {
        if (damageTypeList[protType.toLowerCase()]) {
          protectionArray.push(protType.toLowerCase());
        }
      }
      if (protectionArray.length === 0) {
        protectionArray.push("None");
      }
      item.update({"system.secondaryArmor.protectionTypes": protectionArray});
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorDamageTypes);
  return Promise.resolve();
}

function getDamageTypes(): object {
  let protectionTypes = game.settings.get('twodsix', 'damageTypeOptions').split(',');
  protectionTypes = protectionTypes.map(s => s.trim());
  const returnObject = {};
  for (const type of protectionTypes) {
    Object.assign(returnObject, {[type.toLowerCase()]: type});
  }
  Object.assign(returnObject, {"None": "---"});
  return returnObject;
}
