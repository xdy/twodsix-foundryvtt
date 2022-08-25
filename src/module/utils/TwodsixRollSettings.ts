// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {CE_DIFFICULTIES, CEL_DIFFICULTIES, TWODSIX} from "../config";
import type TwodsixItem from "../entities/TwodsixItem";
import {getKeyByValue} from "./sheetUtils";
import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Gear, Skills} from "../../types/template";
import TwodsixActor from "../entities/TwodsixActor";

export class TwodsixRollSettings {
  difficulty:{ mod:number, target:number };
  diceModifier:number;
  shouldRoll:boolean;
  rollType:string;
  rollMode:DICE_ROLL_MODES;
  characteristic:string;
  skillRoll:boolean;
  difficulties:CE_DIFFICULTIES | CEL_DIFFICULTIES;
  displayLabel:string;
  extraFlavor:string;
  selectedTimeUnit:string;
  timeRollFormula:string;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(settings?:Record<string,any>, aSkill?:TwodsixItem, anItem?:TwodsixItem) {
    this.difficulties = settings?.difficulties ? settings.difficulties : TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    const skill = <Skills>aSkill?.system;
    const difficulty = skill?.difficulty ? this.difficulties[skill.difficulty] : this.difficulties.Average;
    const gear = <Gear>anItem?.system;
    const skillModifier = gear?.skillModifier ?? 0;
    const characteristic = aSkill ? skill.characteristic : "NONE";

    this.difficulty = settings?.difficulty ?? difficulty;
    this.shouldRoll = false;
    this.rollType = settings?.rollType ?? "Normal";
    this.rollMode = settings?.rollMode ?? game.settings.get('core', 'rollMode');
    this.diceModifier = settings?.diceModifier ? settings?.diceModifier + skillModifier : skillModifier;
    this.characteristic = settings?.characteristic ?? characteristic;
    this.skillRoll = !!(settings?.skillRoll ?? aSkill);
    this.displayLabel = settings?.displayLabel ?? "";
    this.extraFlavor = settings?.extraFlavor ?? "";
    this.selectedTimeUnit = "none";
    this.timeRollFormula = "1d6";
  }

  public static async create(showThrowDialog:boolean, settings?:Record<string,any>, skill?:TwodsixItem, item?:TwodsixItem):Promise<TwodsixRollSettings> {
    const twodsixRollSettings = new TwodsixRollSettings(settings, skill, item);
    if (showThrowDialog) {
      //console.log("Create RollSettings, item:", item, " skill: ", skill, " charcteristic:", settings?.characteristic);
      let title:string;
      if (item && skill) {
        title = `${skill.name} ${game.i18n.localize("TWODSIX.Actor.using")} ${item.name}`;
      } else if (skill) {
        title = skill.name || "";
        //check for characterisitc not on actor characteristic list
        if (_genTranslatedSkillList(<TwodsixActor>skill.actor)[twodsixRollSettings.characteristic] === undefined) {
          twodsixRollSettings.characteristic = "NONE";
        }
      } else {
        title = settings?.displayLabel ?? "";
        //console.log("Here:", settings);
      }

      await twodsixRollSettings._throwDialog(title, skill);
      //console.log(twodsixRollSettings);

      //Get display label
      if (skill && skill.actor) {
        if (twodsixRollSettings.characteristic === "NONE") {
          twodsixRollSettings.displayLabel = "";
        } else {
          const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, twodsixRollSettings.characteristic);
          twodsixRollSettings.displayLabel = (<TwodsixActor>skill.actor).system["characteristics"][fullCharLabel]?.displayShortLabel ?? "";
        }
      } else if (skill) {
        twodsixRollSettings.displayLabel = ""; // for unattached skill roll
        twodsixRollSettings.characteristic = "NONE";
      }

    } else {
      twodsixRollSettings.shouldRoll = true;
    }
    console.log("Settings: ", twodsixRollSettings);
    return twodsixRollSettings;
  }

  private async _throwDialog(title:string, skill?: TwodsixItem):Promise<void> {
    const template = 'systems/twodsix/templates/chat/throw-dialog.html';
    const dialogData = {
      rollType: this.rollType,
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: getKeyByValue(this.difficulties, this.difficulty),
      difficulties: this.difficulties,
      rollMode: this.rollMode,
      rollModes: CONFIG.Dice.rollModes,
      diceModifier: this.diceModifier,
      characteristicList: _genTranslatedSkillList(<TwodsixActor>skill?.actor),
      initialChoice: this.characteristic,
      skillRoll: this.skillRoll,
      timeUnits: TWODSIX.TimeUnits,
      selectedTimeUnit: this.selectedTimeUnit,
      timeRollFormula: this.timeRollFormula
    };

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fa-solid fa-dice"></i>',
        callback: (buttonHtml) => {
          this.shouldRoll = true;
          this.difficulty = this.difficulties[buttonHtml.find('[name="difficulty"]').val()];
          this.rollType = buttonHtml.find('[name="rollType"]').val();
          this.rollMode = buttonHtml.find('[name="rollMode"]').val();
          this.characteristic = this.skillRoll ? buttonHtml.find('[name="characteristic"]').val() : this.characteristic;
          this.diceModifier = parseInt(buttonHtml.find('[name="diceModifier"]').val(), 10);
          this.selectedTimeUnit = buttonHtml.find('[name="timeUnit"]').val();
          this.timeRollFormula = buttonHtml.find('[name="timeRollFormula"]').val();
        }
      },
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
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

export function _genTranslatedSkillList(actor:TwodsixActor):object {
  const returnValue = {};
  if (actor) {
    returnValue["STR"] = actor.system["characteristics"].strength.displayShortLabel;
    returnValue["DEX"] = actor.system["characteristics"].dexterity.displayShortLabel;
    returnValue["END"] = actor.system["characteristics"].endurance.displayShortLabel;
    returnValue["INT"] = actor.system["characteristics"].intelligence.displayShortLabel;
    returnValue["EDU"] = actor.system["characteristics"].education.displayShortLabel;
    returnValue["SOC"] = actor.system["characteristics"].socialStanding.displayShortLabel;
    if (game.settings.get('twodsix', 'showAlternativeCharacteristics') !== "base") {
      returnValue["ALT1"] = actor.system["characteristics"].alternative1.displayShortLabel;
      returnValue["ALT2"] =  actor.system["characteristics"].alternative2.displayShortLabel;
    }
    if (game.settings.get('twodsix', 'showAlternativeCharacteristics') !== "alternate") {
      returnValue["PSI"] =  actor.system["characteristics"].psionicStrength.displayShortLabel;
    }
  }
  returnValue["NONE"] =  "---";
  return returnValue;
}

export function _genUntranslatedSkillList(): object {
  const returnValue = {};
  returnValue["STR"] = game.i18n.localize("TWODSIX.Items.Skills.STR");
  returnValue["DEX"] = game.i18n.localize("TWODSIX.Items.Skills.DEX");
  returnValue["END"] = game.i18n.localize("TWODSIX.Items.Skills.END");
  returnValue["INT"] = game.i18n.localize("TWODSIX.Items.Skills.INT");
  returnValue["EDU"] = game.i18n.localize("TWODSIX.Items.Skills.EDU");
  returnValue["SOC"] = game.i18n.localize("TWODSIX.Items.Skills.SOC");
  if (game.settings.get('twodsix', 'showAlternativeCharacteristics') !== "base") {
    returnValue["ALT1"] = game.settings.get('twodsix', 'alternativeShort1');
    returnValue["ALT2"] = game.settings.get('twodsix', 'alternativeShort2');
  }
  if (game.settings.get('twodsix', 'showAlternativeCharacteristics') !== "alternate") {
    returnValue["PSI"] = game.i18n.localize("TWODSIX.Items.Skills.PSI");
  }
  returnValue["NONE"] = "---";
  return returnValue;
}
