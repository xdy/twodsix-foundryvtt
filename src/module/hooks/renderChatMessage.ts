// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import Crit from "../utils/crit";

Hooks.on('renderChatMessageHTML', (app, htmlElement:HTMLElement) => {
  //const html = $(htmlElement);
  const damageMessage = htmlElement.querySelector(".damage-message");
  if (damageMessage) {
    damageMessage.setAttribute("draggable", "true");

    damageMessage.addEventListener('dragstart', ev => {
      return ev.dataTransfer?.setData("text/plain", <string>app.flags.transfer);
    });
  }

  const diceTotal:string = htmlElement.querySelector(".dice-total");
  if (!damageMessage && diceTotal?.textContent.length > 0 && app.isContentVisible) {
    const effect:string = <string>app.getFlag("twodsix", "effect");
    if (!isNaN(Number(effect))) {
      const sumString = game.i18n.localize('TWODSIX.Rolls.sum').capitalize();
      const effectString = game.i18n.localize('TWODSIX.Rolls.Effect');
      let diceTotalText = `<section>${sumString}: ${diceTotal.textContent} ${effectString}: ${effect}</section>`;

      if (game.settings.get("twodsix", "showTimeframe") && <string>app.getFlag("twodsix", "timeframe") !== '' && <string>app.getFlag("twodsix", "timeframe")) {
        const timeframe = <string>app.getFlag("twodsix", "timeframe");
        const timeString = game.i18n.localize('TWODSIX.Rolls.Timeframe');
        diceTotalText += `<section class="roll-detail">${timeString}: ${timeframe}</section>`;
      }

      if (game.settings.get("twodsix", "useDegreesOfSuccess") !== 'none' && <string>app.getFlag("twodsix", "degreeOfSuccess") !== '' && <string>app.getFlag("twodsix", "degreeOfSuccess")) {
        diceTotalText += `<section class="roll-detail">${app.getFlag("twodsix", "degreeOfSuccess")}</section>`;
      }
      diceTotal.innerHTML = diceTotalText;
    }

    // Color crits
    const crit = app.getFlag("twodsix", "crit");
    if (crit && crit == Crit.success) {
      diceTotal.classList.add("crit-success-roll");
    } else if (crit && crit == Crit.fail) {
      diceTotal.classList.add("crit-fail-roll");
    }
  }
});
