// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixItem from "../entities/TwodsixItem";

/**
 * Use a previously created macro.
 * @param {string} itemId
 * @return {Promise}
 */
export async function rollItemMacro(itemId: string): Promise<void> {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) {
    actor = game.actors?.tokens[speaker.token];
  }
  if (!actor && speaker.actor) {
    actor = game.actors?.get(speaker.actor);
  }
  const item:TwodsixItem = actor ? actor.items.find((i) => i.id === itemId) : null;
  if (!item) {
    const unattachedItem = game.items?.get(itemId);
    if (unattachedItem?.type != "weapon" && !actor && unattachedItem) {
      await (<TwodsixItem><unknown>unattachedItem).skillRoll(true);
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActorMissingItem").replace("_ITEM_ID_", itemId));
    }
  } else {
    if (item.type != "weapon") {
      await item.skillRoll(!game.settings.get("twodsix", "invertSkillRollShiftClick"));
    } else {
      await item.resolveUnknownAutoMode();
    }
  }
}

