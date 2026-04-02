import { applyToAllActors } from '../module/utils/migration-utils';

async function radProtectionObject(actor) {
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
      console.log(`Bad message [${messageId}] cannot be deleted. ${err}`);
    }
  }
}

export async function migrate() {
  await applyToAllActors(radProtectionObject);
  await clearBadMessages();
  return Promise.resolve();
}
