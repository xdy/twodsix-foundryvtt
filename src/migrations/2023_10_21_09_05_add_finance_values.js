
import { applyToAllActors} from "../module/utils/migration-utils";
import { getParsedFinanceText, parseLocaleNumber, getMultiplier } from "../module/hooks/updateFinances";

async function migrateFinanceValues(actor) {
  if (["traveller"].includes(actor.type)) {
    const updates = {};
    for (const financeField in actor.system.finances) {
      if (financeField !== "financial-notes") {
        const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
        if (parsedText) {
          const newValue = parseLocaleNumber(parsedText.num) * getMultiplier(parsedText.units);
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
