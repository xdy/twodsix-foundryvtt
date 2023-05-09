import {applyToAllActors} from "../module/utils/migration-utils";

async function mergeContacts(actor) {
  const actorData = actor.system;
  const contacts = actorData.contacts;
  const allies = actorData.allies;
  const enemies = actorData.enemies;

  if (actor.type === 'traveller' && (allies || enemies)) {
    let contactAddition = '';

    if (contacts) {
      contactAddition += `Contacts:<br>${contacts}`;
    }

    if (allies) {
      contactAddition += `<br><br>Allies:<br>${allies}`;
    }

    if (enemies) {
      contactAddition += `<br><br>Enemies:<br>${enemies}`;
    }

    await actor.update({'system.contacts': contactAddition, 'system.allies': '', 'system.enemies': ''});
  }

  return Promise.resolve();
}

export async function migrate() {
  await applyToAllActors(mergeContacts);

  return Promise.resolve();
}
