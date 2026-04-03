import { applyToAllActors } from '../module/utils/migration-utils';

async function convertAgeToNumber(actor) {
  if (actor.type === 'traveller') {
    if ( Object.hasOwn(actor.system.age, "value")) {
      if ( typeof actor.system.age.value !== 'number') {
        await actor.update({ 'system.age.value': Number(actor.system.age.value) || 0});
      }
    }
  }
}
async function applyToInvalid() {
  for(const invalID of game.actors.invalidDocumentIds) {
    const tempActor = await game.actors.getInvalid(invalID);
    await convertAgeToNumber(tempActor);
  }
}

export async function migrate() {
  await applyToAllActors(convertAgeToNumber);
  await applyToInvalid();
  console.log("Age Migration Complete");
  return Promise.resolve();
}
