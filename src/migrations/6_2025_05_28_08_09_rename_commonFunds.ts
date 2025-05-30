// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { applyToAllActors } from "../module/utils/migration-utils";

async function refactorCommonFunds (actor:TwodsixActor): Promise<void> {
  if (actor.type === "ship") {
    if (foundry.utils.hasProperty(actor.system, 'commonFunds')) {
      await actor.update({'system.financeValues': {cash: actor.system.commonFunds*1e6}});
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorCommonFunds);
  console.log("Common Funds Migration Complete");
  return Promise.resolve();
}
