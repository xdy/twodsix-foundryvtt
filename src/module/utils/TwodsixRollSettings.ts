// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {CE_DIFFICULTIES, CEL_DIFFICULTIES, TWODSIX} from "../config";
import type TwodsixItem from "../entities/TwodsixItem";
import {getKeyByValue} from "./sheetUtils";
import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Gear, Skills} from "../../types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { simplifySkillName } from "./utils";
import { effectType } from "../hooks/showStatusIcons";
import { addSign, getCharacteristicFromDisplayLabel } from "./utils";
import { getTargetDMSelectObject } from "./targetModifiers";

export class TwodsixRollSettings {
  difficulty:{ mod:number, target:number };
  //diceModifier:number;
  shouldRoll:boolean;
  rollType:string;
  rollMode:DICE_ROLL_MODES;
  //characteristic:string;
  skillRoll:boolean;
  itemRoll:boolean;
  itemName: string;
  showRangeModifier: boolean;
  showTargetModifier: boolean;
  difficulties:CE_DIFFICULTIES | CEL_DIFFICULTIES;
  displayLabel:string;
  extraFlavor:string;
  selectedTimeUnit:string;
  timeRollFormula:string;
  rollModifiers:Record<any, unknown>;
  skillName:string;
  flags:Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  constructor(settings?:Record<string,any>, aSkill?:TwodsixItem, anItem?:TwodsixItem, sourceActor?:TwodsixActor) {
    this.difficulties = settings?.difficulties ? settings.difficulties : TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    const skill = <Skills>aSkill?.system;
    let skillValue = 0;
    const difficulty = skill?.difficulty ? this.difficulties[skill.difficulty] : this.difficulties.Average;
    const gear = <Gear>anItem?.system;
    const itemName = anItem?.name ?? "";
    const characteristic = settings?.rollModifiers?.characteristic ?? (aSkill ? skill.characteristic : "NONE");
    //Create Flag data for Automated Automations Module
    const itemUUID:string =  settings?.flags?.itemUUID ?? anItem?.uuid ?? aSkill?.uuid ?? "";
    const tokenUUID:string = settings?.flags?.tokenUUID ?? (<Actor>sourceActor)?.getActiveTokens()[0]?.document.uuid ?? "";
    const actorUUID:string = settings?.flags?.actorUUID ?? (<Actor>sourceActor)?.uuid ?? "";
    let rollClass = "";
    const bonusDamage:string = settings?.bonusDamage ?? "";

    let woundsValue = 0;
    let encumberedValue = 0;
    let selectedActor = sourceActor;
    let displayLabel = "";
    if (aSkill && !selectedActor) {
      selectedActor = <TwodsixActor>aSkill.actor;
    } else if (anItem && !selectedActor) {
      selectedActor = <TwodsixActor>anItem.actor;
    }
    if (selectedActor) {
      //Determine active effects modifiers
      if (game.settings.get('twodsix', 'useWoundedStatusIndicators')) {
        woundsValue = (<TwodsixActor>selectedActor).system.conditions.woundedEffect ?? 0;
      }
      if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators')) {
        const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
        encumberedValue = ["strength", "dexterity", "endurance"].includes(fullCharLabel) ? (<TwodsixActor>selectedActor).system.conditions.encumberedEffect ?? 0 : 0;
      }
      //Check for active effect override of skill
      if (aSkill) {
        skillValue = selectedActor.system.skills[simplifySkillName(aSkill.name)] ?? aSkill.system.value; //also need to ?? default? (<Skills>game.system.template?.Item?.skills)?.value
      }

      //Check for "Untrained" value and use if better to account for JOAT
      const joat = (selectedActor.getUntrainedSkill().system)?.value ?? (<Skills>game.system.template?.Item?.skills)?.value;
      if (joat > skillValue) {
        skillValue = joat;
        this.skillName = game.i18n.localize("TWODSIX.Actor.Skills.JOAT");
        //aSkill = selectedActor.getUntrainedSkill();
      } else {
        //skillValue = skill?.value;
        this.skillName = aSkill?.name ?? "?";
      }
      // check for missing display label
      if (!settings?.displayLabel) {
        const fullCharLabel:string = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
        displayLabel = selectedActor.system["characteristics"][fullCharLabel]?.displayShortLabel ?? "";
      }
      //set Active Animation rollClass flag
      if (anItem) {
        if (anItem.type === "weapon") {
          rollClass = "Attack";
        } else if (anItem.type === "component") {
          if (anItem.system.subtype === "armament") {
            rollClass = "ShipWeapon";
          } else {
            rollClass = "ShipAction";
          }
        } else {
          rollClass = "Item";
        }
      } else if (aSkill) {
        rollClass = "Skill";
      } else if (characteristic !== "NONE" && characteristic !== "") {
        rollClass = "Characteristic";
      } else {
        rollClass = "Unknown";
      }
    }
    this.difficulty = settings?.difficulty ?? difficulty;
    this.shouldRoll = false;
    this.rollType = settings?.rollType ?? (aSkill?.system)?.rolltype ??  "Normal";
    this.rollMode = settings?.rollMode ?? game.settings.get('core', 'rollMode');
    this.skillRoll = !!(settings?.skillRoll ?? aSkill);
    this.itemRoll = !!(anItem);
    this.itemName = settings?.itemName ?? itemName;
    this.showRangeModifier =  (game.settings.get('twodsix', 'rangeModifierType') !== 'none' && anItem?.type === "weapon"  && settings?.rollModifiers?.rangeLabel) ?? false;
    this.showTargetModifier = Object.keys(TWODSIX.TARGET_DM).length > 1;
    this.displayLabel = settings?.displayLabel ?? displayLabel;
    this.extraFlavor = settings?.extraFlavor ?? "";
    this.selectedTimeUnit = "none";
    this.timeRollFormula = "1d6";
    this.rollModifiers = {
      rof: settings?.rollModifiers?.rof ?? 0,
      characteristic: characteristic,
      wounds: woundsValue,
      skillValue: skillValue ?? 0,
      item: anItem?.type === "component" ? (parseInt(gear?.rollModifier, 10) || 0) : gear?.skillModifier ?? 0 ,  //need to check for component that uses rollModifier (needs a refactor)
      attachments: anItem?.system?.consumables?.length > 0 ? anItem?.getConsumableBonus("skillModifier") ?? 0 : 0,
      other: settings?.rollModifiers?.other ?? 0,
      encumbered: encumberedValue,
      dodgeParry: settings?.rollModifiers?.dodgeParry ?? 0,
      dodgeParryLabel: settings?.rollModifiers?.dodgeParryLabel ?? "",
      weaponsHandling: settings?.rollModifiers?.weaponsHandling ?? 0,
      weaponsRange: settings?.rollModifiers?.weaponsRange ?? 0,
      rangeLabel: settings?.rollModifiers?.rangeLabel ?? "",
      targetModifier: settings?.rollModifiers?.targetModifier ?? "key0",
      appliedEffects: {},
      chain: settings?.rollModifiers?.chain ?? 0,
      selectedSkill: aSkill?.uuid,
      skillLevelMax: settings?.rollModifiers?.skillLevelMax ?? undefined
    };
    this.flags = {
      rollClass: rollClass,
      tokenUUID: tokenUUID,
      itemUUID: itemUUID,
      actorUUID: actorUUID,
      bonusDamage: bonusDamage
    };
    //console.log("Modifiers: ", this.rollModifiers);
  }

  public static async create(showThrowDialog:boolean, settings?:Record<string,any>, skill?:TwodsixItem, item?:TwodsixItem, sourceActor?:TwodsixActor):Promise<TwodsixRollSettings> {
    const twodsixRollSettings = new TwodsixRollSettings(settings, skill, item, sourceActor);
    if (sourceActor) {
      twodsixRollSettings.rollModifiers.appliedEffects = await getCustomModifiers(sourceActor, twodsixRollSettings.rollModifiers.characteristic, skill);
    }
    if (showThrowDialog) {
      let title:string;
      if (item && skill) {
        title = `${item.name} ${game.i18n.localize("TWODSIX.Actor.using")} ${twodsixRollSettings.skillName}`;
        twodsixRollSettings.itemName = item.name ?? "Unknown Item";
      } else if (skill) {
        title = twodsixRollSettings.skillName || "";
        //check for characterisitc not on actor characteristic list
        if ( _getTranslatedCharacteristicList(<TwodsixActor>skill.actor)[(<string>twodsixRollSettings.rollModifiers.characteristic)] === undefined) {
          twodsixRollSettings.rollModifiers.characteristic = "NONE";
        }
      } else {
        title = twodsixRollSettings.displayLabel ?? "";
      }

      await twodsixRollSettings._throwDialog(title, skill);

      //Get display label
      if (skill && skill.actor) {
        if (twodsixRollSettings.rollModifiers.characteristic === "NONE") {
          twodsixRollSettings.displayLabel = "";
        } else {
          const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, twodsixRollSettings.rollModifiers.characteristic);
          twodsixRollSettings.displayLabel = sourceActor?.system["characteristics"][fullCharLabel]?.displayShortLabel ?? "";
        }
      } else if (skill) {
        twodsixRollSettings.displayLabel = ""; // for unattached skill roll
        twodsixRollSettings.rollModifiers.characteristic = "NONE";
      }

    } else {
      twodsixRollSettings.shouldRoll = true;
    }
    return twodsixRollSettings;
  }

  private async _throwDialog(title:string, skill?: TwodsixItem):Promise<void> {
    const template = 'systems/twodsix/templates/chat/throw-dialog.html';
    const dialogData = {
      rollType: this.rollType,
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: getKeyByValue(this.difficulties, this.difficulty),
      difficulties: this.difficulties,
      skillsList: await skill?.actor?.getSkillNameList(),
      rollMode: this.rollMode,
      rollModes: CONFIG.Dice.rollModes,
      characteristicList: _getTranslatedCharacteristicList(<TwodsixActor>skill?.actor),
      initialChoice: this.rollModifiers.characteristic,
      initialSkill: this.rollModifiers.selectedSkill,
      rollModifiers: this.rollModifiers,
      skillLabel: this.skillName,
      itemLabel: this.itemName,
      showRangeModifier: this.showRangeModifier,
      showTargetModifier: this.showTargetModifier,
      targetModifier: this.rollModifiers.targetModifier,
      targetDMList: getTargetDMSelectObject(),
      skillRoll: this.skillRoll,
      itemRoll: this.itemRoll,
      timeUnits: TWODSIX.TimeUnits,
      selectedTimeUnit: this.selectedTimeUnit,
      timeRollFormula: this.timeRollFormula,
      showConditions: (game.settings.get('twodsix', 'useWoundedStatusIndicators') || game.settings.get('twodsix', 'useEncumbranceStatusIndicators')),
      showWounds: game.settings.get('twodsix', 'useWoundedStatusIndicators'),
      showEncumbered: game.settings.get('twodsix', 'useEncumbranceStatusIndicators'),
    };

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fa-solid fa-dice"></i>',
        callback: (buttonHtml) => {
          this.shouldRoll = true;
          this.difficulty = dialogData.difficulties[buttonHtml.find('[name="difficulty"]').val()];
          this.rollType = buttonHtml.find('[name="rollType"]').val();
          this.rollMode = buttonHtml.find('[name="rollMode"]').val();
          this.rollModifiers.chain = dialogData.skillRoll ? parseInt(buttonHtml.find('[name="rollModifiers.chain"]').val(), 10) : this.rollModifiers.chain;
          this.rollModifiers.characteristic = dialogData.skillRoll ? buttonHtml.find('[name="rollModifiers.characteristic"]').val() : this.rollModifiers.characteristic;
          this.rollModifiers.item = dialogData.itemRoll ? parseInt(buttonHtml.find('[name="rollModifiers.item"]').val(), 10) : this.rollModifiers.item;
          this.rollModifiers.rof = (dialogData.itemRoll && dialogData.rollModifiers.rof) ? parseInt(buttonHtml.find('[name="rollModifiers.rof"]').val(), 10) : this.rollModifiers.rof;
          this.rollModifiers.dodgeParry = (dialogData.itemRoll && dialogData.rollModifiers.dodgeParry) ? parseInt(buttonHtml.find('[name="rollModifiers.dodgeParry"]').val(), 10) : this.rollModifiers.dodgeParry;
          this.rollModifiers.weaponsHandling = (dialogData.itemRoll && dialogData.rollModifiers.weaponsHandling) ? parseInt(buttonHtml.find('[name="rollModifiers.weaponsHandling"]').val(), 10) : this.rollModifiers.weaponsHandling;
          this.rollModifiers.weaponsRange = (dialogData.showRangeModifier) ? parseInt(buttonHtml.find('[name="rollModifiers.weaponsRange"]').val(), 10) : this.rollModifiers.weaponsRange;
          this.rollModifiers.attachments = (dialogData.itemRoll && dialogData.rollModifiers.attachments) ? parseInt(buttonHtml.find('[name="rollModifiers.attachments"]').val(), 10) : this.rollModifiers.attachments;
          this.rollModifiers.other = parseInt(buttonHtml.find('[name="rollModifiers.other"]').val(), 10);
          this.rollModifiers.wounds = dialogData.showWounds ? parseInt(buttonHtml.find('[name="rollModifiers.wounds"]').val(), 10) : 0;
          this.rollModifiers.selectedSkill = dialogData.skillRoll ? buttonHtml.find('[name="rollModifiers.selectedSkill"]').val() : "";
          this.rollModifiers.targetModifier = (dialogData.showTargetModifier) ? buttonHtml.find('[name="rollModifiers.targetModifier"]').val() : this.rollModifiers.targetModifier;

          if(!dialogData.showEncumbered || !["strength", "dexterity", "endurance"].includes(getKeyByValue(TWODSIX.CHARACTERISTICS, this.rollModifiers.characteristic))) {
            //either dont show modifier or not a physical characterisitc
            this.rollModifiers.encumbered = 0;
          } else {
            const dialogEncValue = parseInt(buttonHtml.find('[name="rollModifiers.encumbered"]').val(), 10);
            if (dialogData.initialChoice === this.rollModifiers.characterisitc || dialogEncValue !== dialogData.rollModifiers.encumbered) {
              //characteristic didn't change or encumbrance modifer changed
              this.rollModifiers.encumbered = isNaN(dialogEncValue) ? 0 : dialogEncValue;
            } else {
              this.rollModifiers.encumbered = (<TwodsixActor>skill?.actor)?.system.conditions.encumberedEffect ?? (isNaN(dialogEncValue) ? 0 : dialogEncValue);
            }
          }

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
        render: handleRender,
        close: () => {
          resolve();
        },
      }).render(true);
    });
  }
}
function handleRender(html) {
  html.on("change", ".select-skill", () => {
    const characteristicElement = html.find('[name="rollModifiers.characteristic"]');
    const newSkillUuid = html.find('[name="rollModifiers.selectedSkill"]').val();
    const newSkill = fromUuidSync(newSkillUuid);
    characteristicElement.val(newSkill.system.characteristic);
    let title = "";
    const titleElement = html.parent().parent().find('.window-title')[0];
    if (titleElement) {
      const usingWord = ' ' + game.i18n.localize("TWODSIX.Actor.using") + ' ';
      if (titleElement.innerText.includes(usingWord)) {
        title = `${titleElement.innerText.substring(0, titleElement.innerText.indexOf(usingWord))}${usingWord}${newSkill.name}`;
      } else {
        title = newSkill.name || "";
      }
      titleElement.innerText = title;
    }
  });
}

export function _getTranslatedCharacteristicList(actor:TwodsixActor):object {
  const returnValue = {};
  if (actor) {
    returnValue["STR"] = getCharacteristicLabelWithMod(actor, "strength");
    returnValue["DEX"] = getCharacteristicLabelWithMod(actor, "dexterity");
    returnValue["END"] = getCharacteristicLabelWithMod(actor, "endurance");
    returnValue["INT"] = getCharacteristicLabelWithMod(actor, "intelligence");
    returnValue["EDU"] = getCharacteristicLabelWithMod(actor, "education");
    returnValue["SOC"] = getCharacteristicLabelWithMod(actor, "socialStanding");
    if (!['base', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
      returnValue["ALT1"] = getCharacteristicLabelWithMod(actor, "alternative1");
      returnValue["ALT2"] =  getCharacteristicLabelWithMod(actor, "alternative2");
    }
    if (!['alternate', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
      returnValue["PSI"] =  getCharacteristicLabelWithMod(actor, "psionicStrength");
    }
  }
  returnValue["NONE"] =  "---";
  return returnValue;
}

export function getCharacteristicLabelWithMod(actor: TwodsixActor, characterisitc: string) : string {
  return actor.system.characteristics[characterisitc].displayShortLabel + '(' +
  (actor.system.characteristics[characterisitc].mod >= 0 ? '+' : '') +
  actor.system.characteristics[characterisitc].mod + ')';
}

export function _genUntranslatedCharacteristicList(): object {
  const returnValue = {};
  returnValue["STR"] = game.i18n.localize("TWODSIX.Items.Skills.STR");
  returnValue["DEX"] = game.i18n.localize("TWODSIX.Items.Skills.DEX");
  returnValue["END"] = game.i18n.localize("TWODSIX.Items.Skills.END");
  returnValue["INT"] = game.i18n.localize("TWODSIX.Items.Skills.INT");
  returnValue["EDU"] = game.i18n.localize("TWODSIX.Items.Skills.EDU");
  returnValue["SOC"] = game.i18n.localize("TWODSIX.Items.Skills.SOC");
  if (!['base', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
    returnValue["ALT1"] = game.settings.get('twodsix', 'alternativeShort1');
    returnValue["ALT2"] = game.settings.get('twodsix', 'alternativeShort2');
  }
  if (!['alternate', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
    returnValue["PSI"] = game.i18n.localize("TWODSIX.Items.Skills.PSI");
  }
  returnValue["NONE"] = "---";
  return returnValue;
}

export async function getCustomModifiers(selectedActor:TwodsixActor, characteristic:string, skill?:Skills): Promise<any> {
  const characteristicKey = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
  const simpleSkillRef = skill ? `system.skills.` + simplifySkillName(skill.name) : ``;
  const returnObject = [];
  const customEffects = await selectedActor.appliedEffects.filter(eff => eff.name !== game.i18n.localize(effectType.wounded) && eff.name !== game.i18n.localize(effectType.encumbered));
  for (const effect of customEffects) {
    for (const change of effect.changes) {
      if (change.key === `system.characteristics.${characteristicKey}.mod` || change.key === `system.characteristics.${characteristicKey}.value` || (change.key === simpleSkillRef) && simpleSkillRef) {
        returnObject.push({
          name: effect.name,
          stat: change.key.replace('system.', ''),
          value: addSign(change.value)
        });
      }
    }
  }
  return returnObject;
}

export function getInitialSettingsFromFormula(parseString: string, actor: TwodsixActor): any {
  const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
  // eslint-disable-next-line no-useless-escape
  const re = new RegExp(/^(.[^\/\+=]*?) ?(?:\/([\S]+))? ?(?:(\d{0,2})\+)? ?(?:=(\w*))? ?$/);
  const parsedResult: RegExpMatchArray | null = re.exec(parseString);

  if (parsedResult !== null) {
    const [, parsedSkills, char, diff] = parsedResult;
    const skillOptions = parsedSkills.split("|");
    let skill:TwodsixItem|undefined = undefined;
    /* add qualified skill objects to an array*/
    const skillObjects = actor?.itemTypes.skills?.filter((itm: TwodsixItem) => skillOptions.includes(itm.name));

    // find the most advantageous skill to use from the collection
    if(skillObjects?.length > 0){
      skill = skillObjects.reduce((prev, current) => (prev.system.value > current.system.value) ? prev : current);
    }

    // If skill missing, try to use Untrained
    if (!skill) {
      skill = actor?.itemTypes.skills.find((itm: TwodsixItem) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) as TwodsixItem;
      if (!skill) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorLacksSkill").replace("_ACTOR_NAME_", actor?.name ?? "").replace("_SKILL_", parsedSkills));
        return false;
      }
    }

    // get characteristic key, default to skill key if none specificed in formula
    let characteristicKey = "";
    const charObject = actor?.system["characteristics"] ?? {};
    //we need an array
    const charObjectArray = Object.values(charObject);
    if(!char) {
      characteristicKey = getKeyByValue(TWODSIX.CHARACTERISTICS, (<Skills>skill.system).characteristic);
    } else {
      //find the most advantageous characteristic to use based on the displayed (custom) short label
      const charOptions = char.split("|");
      let candidateCharObject = undefined;
      const candidateCharObjects = charObjectArray.filter(ch => charOptions.includes(ch.displayShortLabel));
      if(candidateCharObjects.length > 0){
        candidateCharObject = candidateCharObjects.reduce((prev, current) =>(prev.mod > current.mod) ? prev: current);
      }
      characteristicKey = candidateCharObject?.key ?? getCharacteristicFromDisplayLabel(char, actor);
    }

    let shortLabel = "NONE";
    let displayLabel = "NONE";
    if (charObject && characteristicKey) {
      shortLabel = charObject[characteristicKey].shortLabel;
      displayLabel = charObject[characteristicKey].displayShortLabel;
    }
    const returnValues = {
      skill: skill,
      skillRoll: true,
      displayLabel: displayLabel,
      rollModifiers: {characteristic: shortLabel}
    };
    if (diff) {
      returnValues["difficulty"] = Object.values(difficulties).filter((difficulty: Record<string, number>) => difficulty.target === parseInt(diff, 10))[0];
    }
    return returnValues;
  } else {
    ui.notifications.error(game.i18n.localize("TWODSIX.Ship.CannotParseArgument"));
    return false;
  }
}
