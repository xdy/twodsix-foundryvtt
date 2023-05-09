import {camelCase} from "../module/settings/settingsUtils";
import {applyToAllItems} from "../module/utils/migration-utils";

async function refactorDamageTypes(item) {
  if (["weapon", "armor", "consumable"].includes(item.type)) {
    const damageTypeList = getDamageTypesMigrate();
    if (["weapon", "consumable"].includes(item.type)) {
      const damageType = camelCase(item.system.damageType);
      item.update({"system.damageType": damageTypeList[damageType] ? damageType : "NONE"});
    } else if (item.type === "armor" && !Array.isArray(item.system.secondaryArmor.protectionTypes)) {
      const protectionArray = [];
      let protectionTypes = item.system.secondaryArmor.protectionTypes.split(',');
      protectionTypes = protectionTypes.map((s) => camelCase(s));
      for (const protType of protectionTypes) {
        if (damageTypeList[protType]) {
          protectionArray.push(protType);
        }
      }
      item.update({"system.secondaryArmor.protectionTypes": protectionArray});
    }
  }
}

function getDamageTypesMigrate() {
  const returnObject = {};
  let protectionTypeLabels = "Ballistic, Bludgeoning, Corrosive, EMP, Energy, Fire, Laser, Piercing, Plasma, Poison, Psionic, Rad, Slashing, Smoke, Stun".split(',');
  protectionTypeLabels = protectionTypeLabels.map((s) => s.trim());
  for (const type of protectionTypeLabels) {
    Object.assign(returnObject, {[camelCase(type)]: type});
  }
  return returnObject;
}

export async function migrate() {
  await applyToAllItems(refactorDamageTypes);
  return Promise.resolve();
}
