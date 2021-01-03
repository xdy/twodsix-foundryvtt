import { TWODSIX } from "../config";

Hooks.on('renderChatMessage', (app, html) => {
  const damageMessage = html.find(".damage-message")[0];
  if (damageMessage) {
    damageMessage.setAttribute("draggable", "true");

    damageMessage.addEventListener('dragstart', ev => {
      return ev.dataTransfer.setData("text/plain", app.data.flags.transfer);
    });
  }

  const diceTotal = html.find(".dice-total");

  if (diceTotal.length > 0) {
    const crit = app.getFlag("twodsix", "crit");
    if (crit && crit == TWODSIX.CRIT.SUCCESS) {
      diceTotal.addClass("crit-success-roll");
    } else if (crit && crit == TWODSIX.CRIT.FAIL) {
      diceTotal.addClass("crit-fail-roll");
    }
  }
});
