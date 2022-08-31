// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Traveller } from "../types/template";
import { applyToAllActors } from "../migration-utils";

async function mergeContacts(actor: TwodsixActor): Promise<void> {
  const actorData = actor.system as Traveller;
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

    await actor.update({ 'system.contacts': contactAddition, 'system.allies': '', 'system.enemies': '' });
  }

  return Promise.resolve();
}

export async function migrate(): Promise<void> {
  await applyToAllActors(mergeContacts);

  return Promise.resolve();
}
