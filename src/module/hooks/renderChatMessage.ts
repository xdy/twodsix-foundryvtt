import {Crit} from "../../types/twodsix";

Hooks.on('renderChatMessage', (app, html) => {
  const damageMessage = html.find(".damage-message")[0];
  if (damageMessage) {
    damageMessage.setAttribute("draggable", "true");

    damageMessage.addEventListener('dragstart', ev => {
      return ev.dataTransfer.setData("text/plain", app.data.flags.transfer);
    });
  }

  if (!damageMessage) {
    const diceTotal = html.find(".dice-total");

    // Add effect
    diceTotal.text(`${game.i18n.localize('TWODSIX.Rolls.sum').capitalize()}: ${diceTotal.text()} ${game.i18n.localize('TWODSIX.Rolls.Effect')}: ${app.getFlag("twodsix", "effect")}`);

    // Color crits
    if (diceTotal.length > 0) {
      const crit = app.getFlag("twodsix", "crit");
      if (crit && crit == Crit.success) {
        diceTotal.addClass("crit-success-roll");
      } else if (crit && crit == Crit.fail) {
        diceTotal.addClass("crit-fail-roll");
      }
    }
  }
});
