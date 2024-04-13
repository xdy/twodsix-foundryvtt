// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { applyToAllActors } from "../module/utils/migration-utils";

async function convertAgeToNumber(actor: TwodsixActor): Promise<void> {
  if (actor.type === 'traveller') {
    if ( Object.hasOwn(actor.system.age, "value")) {
      if ( typeof actor.system.age.value !== 'number') {
        await actor.update({ 'system.age.value': Number(actor.system.age.value) || 0});
      }
    }
  }
}
async function applyToInvalid(): Promise<void> {
  for(const invalID of game.actors.invalidDocumentIds) {
    const tempActor = await game.actors.getInvalid(invalID);
    await convertAgeToNumber(tempActor);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(convertAgeToNumber);
  await applyToInvalid();
  console.log("Age Migration Complete");
  return Promise.resolve();
}
