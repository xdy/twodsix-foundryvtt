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

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(settings?:Record<string,any>, aSkill?:TwodsixItem, anItem?:TwodsixItem) {
    this.difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    const skill = <Skills>aSkill?.data?.data;
    const difficulty = skill?.difficulty ? this.difficulties[skill.difficulty] : this.difficulties.Average;
    const gear = <Gear>anItem?.data?.data;
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
  }

  public static async create(showThrowDialog:boolean, settings?:Record<string,any>, skill?:TwodsixItem, item?:TwodsixItem):Promise<TwodsixRollSettings> {
    const twodsixRollSettings = new TwodsixRollSettings(settings, skill, item);
    if (showThrowDialog) {
      //console.log("Create RollSettings, item:", item, " skill: ", skill, " charcteristic:", settings?.characteristic);
      let title:string;
      if (item && skill) {
        title = `${skill.data.name} ${game.i18n.localize("TWODSIX.Actor.using")} ${item.data.name}`;
      } else if (skill) {
        title = skill.data.name;
        //check for characterisitc not on actor characteristic list
        if (_genTranslatedSkillList(<TwodsixActor>skill.actor)[twodsixRollSettings.characteristic] === undefined) {
          twodsixRollSettings.characteristic = "NONE";
        }
      } else {
        title = settings?.displayLabel ?? "";
        //console.log("Here:", settings);
      }

      await twodsixRollSettings._throwDialog(title, skill);

      //Get display label
      if (skill && skill.actor) {
        if (twodsixRollSettings.characteristic === "NONE") {
          twodsixRollSettings.displayLabel = "";
        } else {
          const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, twodsixRollSettings.characteristic);
          twodsixRollSettings.displayLabel = (<TwodsixActor>skill.actor).data.data["characteristics"][fullCharLabel]?.displayShortLabel ?? "";
        }
      } else if (skill) {
        twodsixRollSettings.displayLabel = ""; // for unattached skill roll
        twodsixRollSettings.characteristic = "NONE";
      }

    } else {
      twodsixRollSettings.shouldRoll = true;
    }
    //console.log("Settings: ", twodsixRollSettings);
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

export function _genTranslatedSkillList(actor:TwodsixActor):object {
  const returnValue = {};
  if (actor) {
    returnValue["STR"] = actor.data.data["characteristics"].strength.displayShortLabel;
    returnValue["DEX"] = actor.data.data["characteristics"].dexterity.displayShortLabel;
    returnValue["END"] = actor.data.data["characteristics"].endurance.displayShortLabel;
    returnValue["INT"] = actor.data.data["characteristics"].intelligence.displayShortLabel;
    returnValue["EDU"] = actor.data.data["characteristics"].education.displayShortLabel;
    returnValue["SOC"] = actor.data.data["characteristics"].socialStanding.displayShortLabel;
    if (game.settings.get('twodsix', 'showAlternativeCharacteristics') !== "base") {
      returnValue["ALT1"] = actor.data.data["characteristics"].alternative1.displayShortLabel;
      returnValue["ALT2"] =  actor.data.data["characteristics"].alternative2.displayShortLabel;
    }
    if (game.settings.get('twodsix', 'showAlternativeCharacteristics') !== "alternate") {
      returnValue["PSI"] =  actor.data.data["characteristics"].psionicStrength.displayShortLabel;
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
