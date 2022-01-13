import { applyToAllActors } from "../migration-utils";
import { Traveller } from "../types/template";

async function mergeContacts(actor: TwodsixActor): Promise<void> {
  const actorData = actor.data.data as Traveller;
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

    await actor.update({ 'data.contacts': contactAddition, 'data.allies': '', 'data.enemies': '' });
    return Promise.resolve();
  }

  return Promise.resolve();
}

export async function migrate(): Promise<void> {
  await applyToAllActors(mergeContacts);

  return Promise.resolve();
}
