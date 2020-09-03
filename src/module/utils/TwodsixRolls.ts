import {advantageDisadvantageTerm} from "../settings";
import { skillRollResultDisplay } from "./sheetUtils";

export class TwodsixRolls {
  static async Roll({
                      parts = [],
                      data = {},
                      flavorParts = [],
                      title = null,
                      speaker = null,
                    } = {}):Promise<unknown> {
    let rolled = false;
    const usefulParts = parts.filter(function (el) {
      return el != '' && el;
    });

    const template = 'systems/twodsix/templates/chat/roll-dialog.html';
    const dialogData = {
      formula: usefulParts.join(' '),
      data: data,
      rollType: game.i18n.localize("Normal"),
      rollTypes: CONFIG.TWODSIX.ROLLTYPES,
      difficulty: game.i18n.localize("Average"),
      difficulties: CONFIG.TWODSIX.DIFFICULTIES,
      rollMode: game.settings.get('core', 'rollMode'),
      rollModes: CONFIG.Dice.rollModes
    };

    const buttons = {
      ok: {
        label: "Roll",
        icon: '<i class="fas fa-dice"></i>',
        callback: (html) => {
          roll = TwodsixRolls._handleRoll({
            form: html[0].children[0],
            rollParts: usefulParts,
            flavorParts,
            speaker
          });
          rolled = true;
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel"),
      },
    };

    const html = await renderTemplate(template, dialogData);
    let roll:Roll;
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: 'ok',
        close: () => {
          resolve(rolled ? roll : false);
        },
      }).render(true);
    });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  static _handleRoll({form = null, rollParts = [], data = {}, flavorParts = [], speaker = null,}):Roll {
    let rollMode = game.settings.get('core', 'rollMode');

    if (form !== null) {
      data['bonus'] = form.bonus.value;
      data['difficulty'] = form.difficulty.value;
      data['rollType'] = form.rollType.value;
      data['rollMode'] = form.rollMode.value;
    }

    if (data['bonus'] && data['bonus'].length > 0) {
      rollParts.push("" + data['bonus']);
    }

    if (data['difficulty'] && data['difficulty'].length > 0) {
      rollParts.push("" + CONFIG.TWODSIX.DIFFICULTIES[data['difficulty']]);
      flavorParts.unshift(`${data['difficulty']}`);
    }

    flavorParts.unshift(game.i18n.localize("TWODSIX.Rolls.Rolling") + ":");

    if (data['rollType'] && data['rollType'].length > 0) {
      rollParts[0] = CONFIG.TWODSIX.ROLLTYPES[data['rollType']];
      if (data['rollType'] != 'Normal') {
        flavorParts.push(game.i18n.localize("TWODSIX.Rolls.With"));
        flavorParts.push(`${(advantageDisadvantageTerm(data['rollType']))}`);
      }
    }

    skillRollResultDisplay(rollParts, flavorParts);
    const roll = new Roll(rollParts.join('+'), data).roll();
    const flavor = flavorParts.join(' ');

    rollMode = form ? form.rollMode.value : rollMode;
    roll.toMessage(
      {
        speaker: speaker,
        flavor: flavor
      },
      {rollMode: rollMode}
    );
    return roll;
  }
}
