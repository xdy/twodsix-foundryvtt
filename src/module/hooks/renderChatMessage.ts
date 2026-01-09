// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import Crit from "../utils/crit";

/**
 * Hook: renderChatMessageHTML
 * Called when a ChatMessage is rendered to the UI. This handler augments the
 * rendered DOM with twodsix-specific behavior: enabling drag transfer of
 * damage messages and populating the dice total/effect/timeframe text when
 * the message content is visible to the current user.
 *
 * Notes:
 * - Respect `message.isContentVisible` to avoid revealing blind/hidden roll
 *   results to unauthorized users.
 * - Always assign flag-driven values via `textContent` (not `innerHTML`) to
 *   prevent HTML injection.
 *
 * @param {ChatMessage | object} message   The ChatMessage document (v14 signature)
 * @param {HTMLElement} html               The rendered chat message element
 * @param {object} [messageData]           Optional message render data
 */
Hooks.on("renderChatMessageHTML", (message: any, html: HTMLElement, messageData?: any) => {
  if (!message || !html) return;

  const damageMessage = html.querySelector<HTMLElement>(".damage-message");
  if (damageMessage) {
    // Only enable dragging when a transfer payload exists
    const transfer:string = message.getFlag("twodsix", "transfer") ?? messageData?.flags?.twodsix?.transfer;
    if (transfer) {
      damageMessage.setAttribute("draggable", "true");
      damageMessage.addEventListener("dragstart", (ev) => {
        if (ev.dataTransfer) ev.dataTransfer.setData("text/plain", transfer);
      });
    }
    // If this message is a damage-message, do not populate roll/effect text.
    return;
  }

  const diceTotal = html.querySelector<HTMLElement>(".dice-total");
  const hasDiceTotal = !!diceTotal && (diceTotal.textContent || "").trim().length > 0;

  if (!damageMessage && hasDiceTotal && message.isContentVisible) {
    const effect = message.getFlag("twodsix", "effect") ?? "";
    if (!isNaN(Number(effect))) {
      const sumString = game.i18n.localize("TWODSIX.Rolls.Sum");
      const effectString = game.i18n.localize("TWODSIX.Rolls.Effect");
      // Use textContent (not innerHTML) to avoid injecting any HTML from flags
      let diceTotalText = `${sumString}: ${diceTotal!.textContent} ${effectString}: ${effect}\n`;

      const timeframe = message.getFlag("twodsix", "timeframe") ?? "";
      if (game.settings.get("twodsix", "showTimeframe") && timeframe.length > 0) {
        const timeString = game.i18n.localize("TWODSIX.Rolls.Timeframe");
        diceTotalText += `${timeString}: ${timeframe}\n`;
      }

      const degreeOfSuccess = message.getFlag("twodsix", "degreeOfSuccess") ?? "";
      if (game.settings.get("twodsix", "useDegreesOfSuccess") !== "none" && degreeOfSuccess.length > 0) {
        diceTotalText += `${degreeOfSuccess}\n`;
      }

      // Assign as textContent to ensure any flag values are not interpreted as HTML
      diceTotal.textContent = diceTotalText;
    }

    // Color crits
    const crit = message.getFlag("twodsix", "crit");
    if (crit && crit === Crit.success) {
      diceTotal.classList.add("crit-success-roll");
    } else if (crit && crit === Crit.fail) {
      diceTotal.classList.add("crit-fail-roll");
    }
  }
});
