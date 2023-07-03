// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors} from "../module/utils/migration-utils";

async function radProtectionObject (actor: TwodsixActor): Promise<void> {
  if (["traveller", "animal", "robot"].includes(actor.type)) {
    if(!isNaN(actor.system.radiationProtection)) {
      actor.update({"system.radiationProtection": {value: 0}});
      console.log(`Updating actor[${actor.id}] radiation protection`);
    }
  }
}

async function clearBadMessages() {
  for (const messageId of Array.from(game.messages.invalidDocumentIds)) {
    try {
      const badMessage = game.messages.getInvalid(messageId);
      await badMessage.delete();
    } catch (err) {
      console.log(`Bad message [${messageId}] cannot be deleted.`);
    }
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(radProtectionObject);
  await clearBadMessages();
  return Promise.resolve();
}
