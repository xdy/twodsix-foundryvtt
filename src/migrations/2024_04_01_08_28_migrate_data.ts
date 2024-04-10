// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { parseLocaleNumber } from "../module/hooks/updateFinances";
import { applyToAllItems, applyToAllActors } from "../module/utils/migration-utils";

async function convertToNumber(item: TwodsixItem): Promise<void> {
  const updates  = {system: {}};
  migrateLocaleStringToNumber(item, updates, "price");
  migrateLocaleStringToNumber(item, updates, "weight");
  migrateLocaleStringToNumber(item, updates, "purchasePrice");
  migrateLocaleStringToNumber(item, updates, "ammo");
  if (Object.keys(updates.system).length > 0) {
    await item.update(updates);
  }
}

async function convertItemNumbers (actor:TwodsixActor): Promise<void> {
  for (const item of actor.items.contents) {
    await convertToNumber(item);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(convertToNumber);
  await applyToAllActors(convertItemNumbers);
  console.log("price, weight, purchasePrice and ammo Migration Complete");
  return Promise.resolve();
}

/**
 * Convert field from string to number respecting local number format, if necessary.
 * @param {any} item data source
 * @param {any} updates update object
 * @param {string} field  system field to convert.
 */
function migrateLocaleStringToNumber(item:TwodsixItem, updates:any, field:string):void {
  if ( Object.hasOwn(item.system, field)) {
    if ( typeof item.system[field] === 'string') {
      Object.assign(updates.system, { [field]: parseLocaleNumber(item.system[field]) || 0});
    }
  }
}
