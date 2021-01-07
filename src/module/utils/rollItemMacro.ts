import TwodsixItem from "../entities/TwodsixItem";

/**
 * Use a previously created macro.
 * @param {string} itemId
 * @return {Promise}
 */
export async function rollItemMacro(itemId:string):Promise<void> {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) {
    actor = game.actors.tokens[speaker.token];
  }
  if (!actor) {
    actor = game.actors.get(speaker.actor);
  }
  const item:TwodsixItem = actor ? actor.items.find((i) => i._id === itemId) : null;
  if (!item) {
    ui.notifications.warn(`Your controlled Actor does not have an item with ID ${itemId}`);
  } else {
    await item.skillRoll(false);
  }
}
