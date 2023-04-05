// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { camelCase } from "../module/settings/settingsUtils";
import { applyToAllItems } from "../module/utils/migration-utils";

async function refactorDamageTypes (item: TwodsixItem): Promise<void> {
  if (["weapon", "armor", "consumable"].includes(item.type)) {
    const damageTypeList = getDamageTypesMigrate();
    if (["weapon", "consumable"].includes(item.type)){
      const damageType  = camelCase(item.system.damageType);
      item.update({"system.damageType": damageTypeList[damageType] ? damageType : "NONE"});
    } else if (item.type === "armor" && !Array.isArray(item.system.secondaryArmor.protectionTypes)) {
      const protectionArray = [];
      let protectionTypes = item.system.secondaryArmor.protectionTypes.split(',');
      protectionTypes = protectionTypes.map((s:string) => camelCase(s));
      for (const protType of protectionTypes) {
        if (damageTypeList[protType]) {
          protectionArray.push(protType);
        }
      }
      item.update({"system.secondaryArmor.protectionTypes": protectionArray});
    }
  }
}

function getDamageTypesMigrate(): object {
  const returnObject = {};
  let protectionTypeLabels:string[] = "Ballistic, Bludgeoning, Corrosive, EMP, Energy, Fire, Laser, Piercing, Plasma, Poison, Psionic, Rad, Slashing, Smoke, Stun".split(',');
  protectionTypeLabels = protectionTypeLabels.map((s:string) => s.trim());
  for (const type of protectionTypeLabels) {
    Object.assign(returnObject, {[camelCase(type)]: type});
  }
  return returnObject;
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorDamageTypes);
  return Promise.resolve();
}
