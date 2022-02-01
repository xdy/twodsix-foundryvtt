import TwodsixItem from "../entities/TwodsixItem";
import { TWODSIX } from "../config";
import {Weapon} from "../../types/template";

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
    if (item.data.type != "weapon") {
      await item.skillRoll(!game.settings.get("twodsix", "invertSkillRollShiftClick"));
    } else {
      if (shouldShowCELAutoFireDialog(item)) {
        const attackType = await promptForROF();
        await item.performAttack(attackType, true);
      } else {
        await item.performAttack("", true);
      }
    }
  }
}

export function shouldShowCELAutoFireDialog(weapon: TwodsixItem): boolean {
  const rateOfFire: string = (<Weapon>weapon.data.data).rateOfFire;
  return (
    (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) &&
    (Number(rateOfFire) > 1)
  );
}

export async function promptForROF(): Promise<string> {
  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
      content: "",
      buttons: {
        single: {
          label: game.i18n.localize("TWODSIX.Dialogs.ROFSingle"), callback: () => {
            resolve('');
          }
        },
        burst: {
          label: game.i18n.localize("TWODSIX.Dialogs.ROFBurst"), callback: () => {
            resolve('auto-burst');
          }
        },
        full: {
          label: game.i18n.localize("TWODSIX.Dialogs.ROFFull"), callback: () => {
            resolve('auto-full');
          }
        }
      },
      default: 'single',
    }).render(true);
  });
}
