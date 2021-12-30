import {TWODSIX} from "../config";
import type TwodsixItem from "../entities/TwodsixItem";
import { getCharShortName } from "./utils";
import {getKeyByValue} from "./sheetUtils";
import Skills = dataTwodsix.Skills;
import Gear = dataTwodsix.Gear;
import { DICE_ROLL_MODES } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";


export class TwodsixRollSettings {
  difficulty:{ mod:number, target:number };
  diceModifier:number;
  shouldRoll:boolean;
  rollType:string;
  rollMode:DICE_ROLL_MODES;
  characteristic:string;
  skillRoll:boolean;
  difficulties:any;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(settings?:any, aSkill?:TwodsixItem, anItem?:TwodsixItem) {
    this.difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    const skill = <Skills>aSkill?.data?.data;
    const difficulty = skill?.difficulty ? this.difficulties[skill.difficulty] : this.difficulties.Average;
    const gear = <Gear>anItem?.data?.data;
    const skillModifier = gear?.skillModifier ?? 0;
    const characteristic = aSkill ?skill.characteristic : "NONE";

    this.difficulty = settings?.difficulty ?? difficulty;
    this.shouldRoll = false;
    this.rollType = settings?.rollType ?? "Normal";
    this.rollMode = settings?.rollMode ?? game.settings.get('core', 'rollMode');
    this.diceModifier = settings?.diceModifier ? settings?.diceModifier + skillModifier : skillModifier;
    this.characteristic = settings?.characteristic ?? characteristic;
    this.skillRoll = !!(settings?.skillRoll ?? aSkill);
  }

  public static async create(showThrowDialog:boolean, settings?:unknown, skill?:TwodsixItem, item?:TwodsixItem):Promise<TwodsixRollSettings> {
    const twodsixRollSettings = new TwodsixRollSettings(settings, skill, item);
    if (showThrowDialog) {
      let title:string;
      if (item && skill) {
        title = `${skill.data.name} ${game.i18n.localize("TWODSIX.Actor.using")} ${item.data.name}`;
      } else if (skill) {
        title = skill.data.name;
      } else {
        title = getCharShortName(twodsixRollSettings.characteristic);
      }
      await twodsixRollSettings._throwDialog(title);
    } else {
      twodsixRollSettings.shouldRoll = true;
    }
    return twodsixRollSettings;
  }

  private async _throwDialog(title:string):Promise<void> {
    const template = 'systems/twodsix/templates/chat/throw-dialog.html';
    const dialogData = {
      rollType: this.rollType,
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: getKeyByValue(this.difficulties, this.difficulty),
      difficulties: this.difficulties,
      rollMode: this.rollMode,
      rollModes: CONFIG.Dice.rollModes,
      diceModifier: this.diceModifier,
      characteristic: this.characteristic,
      skillRoll: this.skillRoll
    };

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fas fa-dice"></i>',
        callback: (buttonHtml) => {
          this.shouldRoll = true;
          this.difficulty = this.difficulties[buttonHtml.find('[name="difficulty"]').val()];
          this.rollType = buttonHtml.find('[name="rollType"]').val();
          this.rollMode = buttonHtml.find('[name="rollMode"]').val();
          this.characteristic = this.skillRoll ? buttonHtml.find('[name="characteristic"]').val() : this.characteristic;
          this.diceModifier = parseInt(buttonHtml.find('[name="diceModifier"]').val(), 10);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel"),
        callback: () => {
          this.shouldRoll = false;
        }
      },
    };

    const html = await renderTemplate(template, dialogData);
    return new Promise<void>((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: 'ok',
        close: () => {
          resolve();
        },
      }).render(true);
    });
  }
}
