import TwodsixItem from '../entities/TwodsixItem';
import { TWODSIX } from '../config';
import {getGame, getUi} from './utils';

/**
 * Use a previously created macro.
 * @param {string} itemId
 * @return {Promise}
 */
export async function rollItemMacro(itemId: string): Promise<void> {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) {
    actor = getGame().actors?.tokens[speaker.token];
  }
  if (!actor && speaker.actor) {
    actor = getGame().actors?.get(speaker.actor);
  }
  const item:TwodsixItem = actor ? actor.items.find((i) => i.id === itemId) : null;
  if (!item) {
    getUi().notifications?.warn(getGame().i18n.localize('TWODSIX.Warnings.ActorMissingItem').replace('_ITEM_ID_', itemId));
  } else {
    if (item.data.type != 'weapon') {
      await item.skillRoll(false);
    } else {
      if (shouldShowCELAutoFireDialog(item)) {
        const attackType = await promptForROF();
        await item.performAttack(attackType, true);
      } else {
        await item.performAttack('', true);
      }
    }
  }
}

function shouldShowCELAutoFireDialog(weapon: TwodsixItem): boolean {
  return (
    (getGame().settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) &&
    (weapon.data.data.rateOfFire > 1)
  );
}

async function promptForROF(): Promise<string> {
  return new Promise((resolve) => {
    new Dialog({
      title: getGame().i18n.localize('TWODSIX.Dialogs.ROFPickerTitle'),
      content: '',
      buttons: {
        single: {
          label: getGame().i18n.localize('TWODSIX.Dialogs.ROFSingle'), callback: () => {
            resolve('');
          }
        },
        burst: {
          label: getGame().i18n.localize('TWODSIX.Dialogs.ROFBurst'), callback: () => {
            resolve('auto-burst');
          }
        },
        full: {
          label: getGame().i18n.localize('TWODSIX.Dialogs.ROFFull'), callback: () => {
            resolve('auto-full');
          }
        }
      },
      default: 'single',
    }).render(true);
  });
}
