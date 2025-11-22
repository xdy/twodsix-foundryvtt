/**
 * Use a previously created macro.
 * @param {string} itemId Item's id
 * @param {string}  itemName Item's name
 * @return {Promise}
 */
export async function rollItemMacro(itemId, itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) {
    actor = game.actors.tokens[speaker.token];
  }
  if (!actor && speaker.actor) {
    actor = /** @type {TwodsixActor} */ game.actors.get(speaker.actor);
  }
  const item =/** @type {TwodsixItem} */ actor ? (actor.items.get(itemId) ?? actor.items.getName(itemName)) : undefined;
  if (!item) {
    const unattachedItem = game.items.get(itemId) ?? game.items.getName(itemName);
    if (unattachedItem?.type !== "weapon" && !actor && unattachedItem) {
      await (unattachedItem).skillRoll(true);
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActorMissingItem").replace("_ITEM_ID_", itemId));
    }
  } else {
    if (item.type !== "weapon") {
      await item.skillRoll(!game.settings.get("twodsix", "invertSkillRollShiftClick"));
    } else {
      await item.resolveUnknownAutoMode(true);
    }
  }
}

