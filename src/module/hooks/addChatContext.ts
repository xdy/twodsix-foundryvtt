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
    return message?.isRoll && message?.isContentVisible && canvas.tokens?.controlled.length;
  };
  options.push(
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    },
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyDestructiveDamage"),
      icon: '<i class="fas fa-user-injured"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 10)
    },
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyReducedDamage"),
      icon: '<i class="fas fa-user-shield"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 0.1)
    },
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyHealing"),
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
  const transfer = message.flags.transfer ? JSON.parse(message.flags.transfer) : undefined;
  const effect = transfer?.payload.damageValue ?? message.flags.twodsix?.effect ?? message.rolls[0].total;
  if (effect > 0) {
    return Promise.all(canvas.tokens.controlled.map(t => {
      if (["traveller", "robot", "animal"].includes(t.actor.type)) {
        const damage = Math.floor(effect * multiplier);
        if (damage > 0) {
          t.actor.damageActor(Math.floor(effect * multiplier), transfer?.payload.armorPiercingValue ?? 0, transfer?.payload.damageType ?? "", true);
        } else if (multiplier < 0) {
          t.actor.healActor(effect);
        }
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamage"));
      }
    }));
  } else {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoDamageToApply"));
  }
}
