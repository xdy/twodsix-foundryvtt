import {Crit} from '../utils/crit';
import {getGame} from '../utils/utils';

Hooks.on('renderChatMessage', (app, html) => {
  const damageMessage = html.find('.damage-message')[0];
  if (damageMessage) {
    damageMessage.setAttribute('draggable', 'true');

    damageMessage.addEventListener('dragstart', ev => {
      return ev.dataTransfer?.setData('text/plain', <string>app.data.flags.transfer);
    });
  }

  const diceTotal = html.find('.dice-total');
  if (!damageMessage && diceTotal.length > 0 && app.isContentVisible) {
    const effect:string = <string>app.getFlag('twodsix', 'effect');
    if (!isNaN(Number(effect))) {
      const sumString = getGame().i18n.localize('TWODSIX.Rolls.sum').capitalize();
      const effectString = getGame().i18n.localize('TWODSIX.Rolls.Effect');
      diceTotal.text(`${sumString}: ${diceTotal.text()} ${effectString}: ${effect}`);
    }

    // Color crits
    const crit = app.getFlag('twodsix', 'crit');
    if (crit && crit == Crit.Success) {
      diceTotal.addClass('crit-success-roll');
    } else if (crit && crit == Crit.Fail) {
      diceTotal.addClass('crit-fail-roll');
    }
  }
});
