import { TravellerData } from '../module/data/actors/travellerData';
import { parseLocaleNumber } from '../module/data/commonSchemaUtils.js';
import { applyToAllActors } from '../module/utils/migration-utils';

async function migrateFinanceValues(actor) {
  if (["traveller"].includes(actor.type)) {
    const updates = {};
    for (const financeField in actor.system.finances) {
      if (financeField !== "financial-notes") {
        const parsedText = TravellerData.getParsedFinanceText(actor.system.finances[financeField]);
        if (parsedText) {
          const newValue = parseLocaleNumber(parsedText.num) * TravellerData.getMultiplier(parsedText.units);
          Object.assign(updates, {[financeField]: newValue});
        }
      }
    }
    actor.update({"system.financeValues": updates});
  }
}

export async function migrate() {
  await applyToAllActors(migrateFinanceValues);
  console.log ("Finance Values Migrated");
  return Promise.resolve();
}
