// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../module/config";
import { applyToAllItems } from "../module/utils/migration-utils";

async function refactorRangeBands(item: TwodsixItem): Promise<void> {
  if (item.type === 'weapon') {
    if(Object.hasOwn(TWODSIX.CE_WEAPON_RANGE_TYPES.long, item.system.rangeBand)) {
      return;
    }

    if (item.system.rangeBand.toLowerCase().includes('shotgun') || item.name.toLowerCase().includes('shotgun')) {
      item.update({'system.rangeBand': 'shotgun'});
    } else if (item.system.rangeBand.toLowerCase().includes('pistol') || item.name.toLowerCase().includes('pistol')) {
      item.update({'system.rangeBand': 'pistol'});
    } else if (item.system.rangeBand.toLowerCase().includes('revolver') || item.name.toLowerCase().includes('revolver')) {
      item.update({'system.rangeBand': 'pistol'});
    } else if (item.system.rangeBand.toLowerCase().includes('assualt') || item.name.toLowerCase().includes('assault')) {
      item.update({'system.rangeBand': 'assaultWeapon'});
    } else if (item.system.rangeBand.toLowerCase().includes('machine') || item.name.toLowerCase().includes('machine')) {
      item.update({'system.rangeBand': 'assaultWeapon'});
    } else if (item.system.rangeBand.toLowerCase().includes('rifle') || item.name.toLowerCase().includes('rifle')) {
      item.update({'system.rangeBand': 'rifle'});
    } else if (item.system.rangeBand.toLowerCase().includes('melee') || item.name.toLowerCase().includes('melee')) {
      item.update({'system.rangeBand': 'extendedReach'});
    } else if (item.system.rangeBand.toLowerCase().includes('rocket') || item.name.toLowerCase().includes('rocket')) {
      item.update({'system.rangeBand': 'rocket'});
    } else if (item.system.rangeBand === "" || item.system.rangeBand === "0" ) {
      item.update({'system.rangeBand': 'closeQuarters'});
    } else {
      item.update({'system.rangeBand': 'none'});
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorRangeBands);
  console.log("Range Band Migration Complete");
  return Promise.resolve();
}
