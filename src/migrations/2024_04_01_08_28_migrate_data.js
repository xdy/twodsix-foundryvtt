import { parseLocaleNumber } from "../module/hooks/updateFinances";
import { applyToAllItems, applyToAllActors } from "../module/utils/migration-utils";

async function convertToNumber(item) {
  const updates  = {system: {}};
  migrateLocaleStringToNumber(item, updates, "price");
  migrateLocaleStringToNumber(item, updates, "weight");
  migrateLocaleStringToNumber(item, updates, "purchasePrice");
  migrateLocaleStringToNumber(item, updates, "ammo");
  if (!foundry.utils.isEmpty(updates.system)) {
    await item.update(updates);
  }
}

async function convertItemNumbers(actor) {
  for (const item of actor.items.contents) {
    await convertToNumber(item);
  }
}

export async function migrate() {
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
function migrateLocaleStringToNumber(item, updates, field) {
  if ( Object.hasOwn(item.system, field)) {
    if ( typeof item.system[field] === 'string') {
      Object.assign(updates.system, { [field]: parseLocaleNumber(item.system[field]) || 0});
    }
  }
}
