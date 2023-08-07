// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import Crit from "../utils/crit";

Hooks.on('renderChatMessage', (app, html) => {
  const damageMessage = html.find(".damage-message")[0];
  if (damageMessage) {
    damageMessage.setAttribute("draggable", "true");

    damageMessage.addEventListener('dragstart', ev => {
      return ev.dataTransfer?.setData("text/plain", <string>app.flags.transfer);
    });
  }

  const diceTotal = html.find(".dice-total");
  if (!damageMessage && diceTotal.length > 0 && app.isContentVisible) {
    const effect:string = <string>app.getFlag("twodsix", "effect");
    if (!isNaN(Number(effect))) {
      const sumString = game.i18n.localize('TWODSIX.Rolls.sum').capitalize();
      const effectString = game.i18n.localize('TWODSIX.Rolls.Effect');
      let diceTotalText = `<section>${sumString}: ${diceTotal.text()} ${effectString}: ${effect}</section>`;

      if (game.settings.get("twodsix", "showTimeframe") && <string>app.getFlag("twodsix", "timeframe") !== '' && <string>app.getFlag("twodsix", "timeframe")) {
        const timeframe = <string>app.getFlag("twodsix", "timeframe");
        const timeString = game.i18n.localize('TWODSIX.Rolls.Timeframe');
        diceTotalText += `<section class="roll-detail">${timeString}: ${timeframe}</section>`;
      }

      if (game.settings.get("twodsix", "useDegreesOfSuccess") !== 'none' && <string>app.getFlag("twodsix", "degreeOfSuccess") !== '' && <string>app.getFlag("twodsix", "degreeOfSuccess")) {
        diceTotalText += `<section class="roll-detail">${app.getFlag("twodsix", "degreeOfSuccess")}</section>`;
      }
      diceTotal.html(diceTotalText);
    }

    // Color crits
    const crit = app.getFlag("twodsix", "crit");
    if (crit && crit == Crit.success) {
      diceTotal.addClass("crit-success-roll");
    } else if (crit && crit == Crit.fail) {
      diceTotal.addClass("crit-fail-roll");
    }
  }
});
