// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

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
    if (item.type != "weapon") {
      await item.skillRoll(!game.settings.get("twodsix", "invertSkillRollShiftClick"));
    } else {
      resolveUnknownAutoMode(item);
    }
  }
}

export function shouldShowCELAutoFireDialog(weapon: TwodsixItem): boolean {
  const rateOfFire: string = (<Weapon>weapon.system).rateOfFire;
  return (
    (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) &&
    (Number(rateOfFire) > 1)
  );
}

export function shouldShowCEAutoFireDialog(weapon: TwodsixItem): boolean {
  const modes = ((<Weapon>weapon.system).rateOfFire ?? "").split(/[-/]/);
  return (
    (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key) &&
    (modes.length > 1)
  );
}

export async function promptForCELROF(): Promise<string> {
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

export async function promptAndAttackForCE(modes: string[], item: TwodsixItem) {
  const buttons = {};

  for ( const mode of modes) {
    const number = Number(mode);
    const attackDM = TwodsixItem.burstAttackDM(number);
    const bonusDamage =TwodsixItem.burstBonusDamage(number);

    if (number === 1) {
      buttons["single"] = {
        "label": game.i18n.localize("TWODSIX.Dialogs.ROFSingle"),
        "callback": () => {
          item.performAttack("", true, 1);
        }
      };
    } else if (number > 1){
      let key = game.i18n.localize("TWODSIX.Rolls.AttackDM")+ ' +' + attackDM;
      buttons[key] = {
        "label": key,
        "callback": () => {
          item.performAttack('burst-attack-dm', true, number);
        }
      };

      key = game.i18n.localize("TWODSIX.Rolls.BonusDamage") + ' +' + bonusDamage;
      buttons[key] = {
        "label": key,
        "callback": () => {
          item.performAttack('burst-bonus-damage', true, number);
        }
      };
    }
  }

  await new Dialog({
    title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
    content: "",
    buttons: buttons,
    default: "single"
  }).render(true);
}

export async function resolveUnknownAutoMode(item: TwodsixItem) {
  let attackType = "";
  const modes = ((<Weapon>item.system).rateOfFire ?? "").split(/[-/]/);;
  switch (game.settings.get('twodsix', 'autofireRulesUsed')) {
    case TWODSIX.RULESETS.CEL.key:
      if (shouldShowCELAutoFireDialog(item)) {
        attackType = await promptForCELROF();
      }
      await item.performAttack(attackType, true);
      break;
    case TWODSIX.RULESETS.CE.key:
      if (modes.length > 1) {
        await promptAndAttackForCE(modes, item);
      } else {
        await item.performAttack("", true, Number(modes[0]));
      }
      break;
    default:
      await item.performAttack(attackType, true);
      break;
  }
}
