// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("getChatLogEntryContext", addChatMessageContextOptions);

/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {object[]} options    The Array of Context Menu options
 *
 * @returns {object[]}          The extended options Array including new context choices
 */
function addChatMessageContextOptions(html, options) {
  const canApply = li => {
    const message = game.messages.get(li.data("messageId"));
    return message?.isRoll && message?.isContentVisible && canvas.tokens?.controlled.length  && message.flags.transfer;
  };
  options.push(
    {
      name: game.i18n.localize("Damage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    },
    {
      name: game.i18n.localize("Heal"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, -1)
    }
  );
  return options;
}

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 *
 * @param {HTMLElement} li      The chat entry which contains the roll data
 * @param {number} multiplier   A damage multiplier to apply to the rolled damage.
 * @returns {Promise}
 */
function applyChatCardDamage(li, multiplier) {
  const message = game.messages.get(li.data("messageId"));
  const transfer = JSON.parse(message.flags.transfer);
  if (transfer.type === "damageItem") {
    return Promise.all(canvas.tokens.controlled.map(t => {
      if (["traveller", "robot", "animal"].includes(t.actor.type)) {
        if (multiplier > 0) {
          t.actor.damageActor(transfer.payload.damageValue, transfer.payload.armorPiercingValue, transfer.payload.damageType, true);
        } else {
          t.actor.healActor(transfer.payload.damageValue);
        }
      }
    }));
  }
}
