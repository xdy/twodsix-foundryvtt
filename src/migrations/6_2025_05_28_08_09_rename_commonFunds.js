import { applyToAllActors } from '../module/utils/migration-utils';

async function refactorCommonFunds(actor) {
  if (actor.type === "ship") {
    if (foundry.utils.hasProperty(actor.system, 'commonFunds')) {
      await actor.update({'system.financeValues': {cash: actor.system.commonFunds*1e6}});
    }
  }
}

export async function migrate() {
  await applyToAllActors(refactorCommonFunds);
  console.log("Common Funds Migration Complete");
  return Promise.resolve();
}
