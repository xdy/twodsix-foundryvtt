// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors} from "../module/utils/migration-utils";
import { getParsedFinanceText, parseLocaleNumber, getMultiplier } from "../module/hooks/updateFinances";

async function migrateFinanceValues (actor: TwodsixActor): Promise<void> {
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

export async function migrate(): Promise<void> {
  await applyToAllActors(migrateFinanceValues);
  console.log ("Finance Values Migrated");
  return Promise.resolve();
}
