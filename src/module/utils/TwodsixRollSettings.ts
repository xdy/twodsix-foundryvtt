// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {CE_DIFFICULTIES, CEL_DIFFICULTIES, TWODSIX} from "../config";
import type TwodsixItem from "../entities/TwodsixItem";
import { getKeyByValue } from "./utils";
import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Gear, Skills} from "../../types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { simplifySkillName } from "./utils";
import { addSign, getCharacteristicFromDisplayLabel } from "./utils";
import RollDialog, { _getTranslatedCharacteristicList } from "./RollDialog";

export class TwodsixRollSettings {
  bonusDamage:string;
  difficulty:{ mod:number, target:number };
  //diceModifier:number;
  shouldRoll:boolean;
  rollType:string;
  rollMode:DICE_ROLL_MODES;
  //characteristic:string;
  skillRoll:boolean;
  itemRoll:boolean;
  isPsionicAbility:boolean;
  isComponent:boolean;
  itemName: string;
  showRangeModifier: boolean;
  showTargetModifier: boolean;
  showArmorWeaponModifier: boolean;
  difficulties:CE_DIFFICULTIES | CEL_DIFFICULTIES;
  displayLabel:string;
  extraFlavor:string;
  selectedTimeUnit:string;
  timeRollFormula:string;
  rollModifiers:Record<any, unknown>;
  skillName:string;
  flags:Record<string, unknown>;

  constructor(settings?:Record<string,any>, aSkill?:TwodsixItem, anItem?:TwodsixItem, sourceActor?:TwodsixActor) {
    this.difficulties = settings?.difficulties ? settings.difficulties : TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    const skill = <Skills>aSkill?.system;
    let skillValue = 0;
    const difficulty = skill?.difficulty ? this.difficulties[skill.difficulty] : this.difficulties.Average;
    const itemName = anItem?.name ?? "";
    const characteristic = settings?.rollModifiers?.characteristic ?? (aSkill && game.settings.get('twodsix', 'ruleset') !== 'CT' ? skill.characteristic : "NONE");
    //Create Flag data for Automated Automations Module
    const itemUUID:string =  settings?.flags?.itemUUID ?? anItem?.uuid ?? aSkill?.uuid ?? "";
    const tokenUUID:string = settings?.flags?.tokenUUID ?? (<Actor>sourceActor)?.getActiveTokens()[0]?.document.uuid ?? "";
    const actorUUID:string = settings?.flags?.actorUUID ?? (<Actor>sourceActor)?.uuid ?? "";
    let rollClass = "";
    this.bonusDamage = settings?.bonusDamage ?? "";

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
      if (selectedActor.type === 'ship') {
        displayLabel = characteristic;
      } else {
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
          skillValue = selectedActor.system.skills[simplifySkillName(aSkill.name)] ?? aSkill.system.value; //also need to ?? default? CONFIG.Item.dataModels.skills.schema.getInitialValue().value
        }

        //Check for "Untrained" value and use if better to account for JOAT
        const joat = (selectedActor.getUntrainedSkill()?.system)?.value ?? CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
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
          } ////NEED TO EXPAND TYPES HERE to INCLUDE SP
        } else if (anItem.type === "spell") {
          rollClass = "Spell";
        } else if (anItem.type === "psiAbility") {
          rollClass = "PsionicAbility";
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
    this.isPsionicAbility = this.itemRoll ? anItem.type === "psiAbility" : false;
    this.isComponent = anItem?.type === "component";
    this.itemName = settings?.itemName ?? itemName;
    this.showRangeModifier =  (game.settings.get('twodsix', 'rangeModifierType') !== 'none' && anItem?.type === "weapon"  && settings?.rollModifiers?.rangeLabel) ?? false;
    this.showTargetModifier = Object.keys(TWODSIX.TARGET_DM).length > 1;
    this.showArmorWeaponModifier = game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands' || game.settings.get('twodsix', 'ruleset') === 'CT';
    this.displayLabel = settings?.displayLabel ?? displayLabel;
    this.extraFlavor = settings?.extraFlavor ?? "";
    this.selectedTimeUnit = "none";
    this.timeRollFormula = "1d6";
    this.rollModifiers = {
      rof: settings?.rollModifiers?.rof ?? 0,
      characteristic: characteristic,
      wounds: woundsValue,
      skillValue: skillValue ?? 0,
      item: this.getItemModifier(anItem),
      componentDamage: this.getComponentDamage(anItem),
      attachments: anItem?.system?.consumables?.length > 0 ? anItem?.getConsumableBonus("skillModifier") ?? 0 : 0,
      other: settings?.rollModifiers?.other ?? 0,
      encumbered: encumberedValue,
      dodgeParry: settings?.rollModifiers?.dodgeParry ?? 0,
      dodgeParryLabel: settings?.rollModifiers?.dodgeParryLabel ?? "",
      weaponsHandling: settings?.rollModifiers?.weaponsHandling ?? 0,
      weaponsRange: settings?.rollModifiers?.weaponsRange ?? 0,
      rangeLabel: settings?.rollModifiers?.rangeLabel ?? "",
      targetModifier: settings?.rollModifiers?.targetModifier?.length > 0 ? settings.rollModifiers.targetModifier : [],
      targetModifierOverride: settings?.rollModifiers?.targetModifierOverride ?? false,
      appliedEffects: {},
      chain: settings?.rollModifiers?.chain ?? 0,
      selectedSkill: aSkill?.uuid || settings?.rollModifiers?.selectedSkill,
      skillLevelMax: settings?.rollModifiers?.skillLevelMax ?? undefined,
      armorModifier: settings?.rollModifiers?.armorModifier ?? 0,
      armorLabel: settings?.rollModifiers?.armorLabel ?? ""
    };
    this.flags = {
      rollClass: rollClass,
      tokenUUID: tokenUUID,
      itemUUID: itemUUID,
      actorUUID: actorUUID,
      bonusDamage: this.bonusDamage
    };
  }

  public static async create(showThrowDialog:boolean, settings?:Record<string,any>, skill?:TwodsixItem, item?:TwodsixItem, sourceActor?:TwodsixActor):Promise<TwodsixRollSettings> {
    const twodsixRollSettings = new TwodsixRollSettings(settings, skill, item, sourceActor);
    if (sourceActor) {
      twodsixRollSettings.rollModifiers.appliedEffects = getCustomModifiers(sourceActor, twodsixRollSettings.rollModifiers.characteristic, skill);
    }
    if (showThrowDialog) {
      let title:string;
      if (item && skill) {
        title = `${item.name} ${game.i18n.localize("TWODSIX.Actor.using")} ${twodsixRollSettings.skillName}`;
        twodsixRollSettings.itemName = item.name ?? "Unknown Item";
      } else if (skill) {
        title = twodsixRollSettings.skillName || "";
        //check for characteristic not on actor characteristic list
        if ( _getTranslatedCharacteristicList(<TwodsixActor>skill.actor)[(<string>twodsixRollSettings.rollModifiers.characteristic)] === undefined) {
          twodsixRollSettings.rollModifiers.characteristic = "NONE";
        }
      } else {
        title = twodsixRollSettings.displayLabel ?? "";
      }

      await twodsixRollSettings._throwDialog(title, twodsixRollSettings, skill);

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

  private async _throwDialog(title:string, twodsixRollSettings, skill?: TwodsixItem):Promise<void> {
    await RollDialog.prompt({title: title, skill: skill, 'settings': twodsixRollSettings});
    return(twodsixRollSettings);
  }

  private getItemModifier(anItem?: TwodsixItem): number {
    if (!anItem) {
      return 0;
    }

    const gear = anItem.system as Gear;
    return anItem.type === "component"
      ? (parseInt(gear?.rollModifier, 10) || 0)
      : (gear?.skillModifier ?? 0);
  }

  private getComponentDamage(anItem?: TwodsixItem): number {
    if (anItem?.type !== "component") {
      return 0;
    }

    const gear = anItem.system as Gear;
    return gear?.hits * (game.settings.get('twodsix', 'componentDamageDM') as number) || 0;
  }
}


export function getCharacteristicLabelWithMod(actor: TwodsixActor, characteristic: string) : string {
  return actor.system.characteristics[characteristic].displayShortLabel + '(' +
  (actor.system.characteristics[characteristic].mod >= 0 ? '+' : '') +
  actor.system.characteristics[characteristic].mod + ')';
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
  if (['all'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
    returnValue["ALT3"] = game.settings.get('twodsix', 'alternativeShort3');
  }
  if (!['alternate', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
    returnValue["PSI"] = game.i18n.localize("TWODSIX.Items.Skills.PSI");
  }
  returnValue["NONE"] = "---";
  return returnValue;
}

export function getCharacteristicList(actor?:TwodsixActor|undefined): any {
  let returnValue = {};
  if (actor) {
    returnValue = _getTranslatedCharacteristicList(actor);
  } else {
    returnValue = _genUntranslatedCharacteristicList();
  }
  return returnValue;
}

/**
 * Retrieves custom roll modifiers for the selected actor, characteristic, and skill.
 * Filters out effects with 'encumbered' or 'wounded' statuses, then collects relevant changes
 * that modify the specified characteristic or skill. Returns an array of modifier objects.
 *
 * @param {TwodsixActor} selectedActor - The actor whose effects are being checked.
 * @param {string} characteristic - The characteristic to match for modifiers.
 * @param {Skills} [skill] - Optional skill to match for modifiers.
 * @returns {Array<{name: string, stat: string, value: string}>} Array of modifier objects.
 */
export function getCustomModifiers(selectedActor:TwodsixActor, characteristic:string, skill?:Skills): Array<{name: string, stat:string, value:string}> {
  const characteristicKey = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
  const simpleSkillRef = skill ? `system.skills.` + simplifySkillName(skill.name) : ``;
  const returnObject = [];
  const customEffects = selectedActor.appliedEffects.filter(eff  => !eff.statuses.has('encumbered') && !eff.statuses.has('wounded'));
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

/**
 * Returns initial roll settings based on a coded string for a roll formula
 * @param {string} parseString A string of roll parameters.  It has the format 'Skill 1 | Skill 2/Char1 | Char 2 Difficulty+ =Item Id'
 * e.g. 'Engineering|Mechanic/INT|EDU 6+'.  For a characteristic Roll, use 'None' instead of a skill name.
 * @param {TwodsixActor} actor The actor that posesses the skill
 * @returns {TwodsixRollSettings | any} an object of the initial RollSettings
 */
export function getInitialSettingsFromFormula(parseString: string, actor: TwodsixActor): TwodsixRollSettings|any {
  const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
  // eslint-disable-next-line no-useless-escape
  const re = new RegExp(/^(.[^\/\+=]*?) ?(?:\/([\S]+))? ?(?:(\d{0,2})\+)? ?(?:=(\w*))? ?$/);
  const parsedResult: RegExpMatchArray | null = re.exec(parseString);

  if (parsedResult !== null) {
    const [, parsedSkills, char, diff] = parsedResult;

    // Set difficulty
    let difficulty: string|undefined = undefined;
    let otherMod = 0;
    if (diff) {
      let diffSelected = parseInt(diff, 10);
      // Adjust for odd difficulty values
      otherMod = diffSelected % 2 ? 1 : 0;
      diffSelected += diffSelected % 2;
      difficulty = Object.values(difficulties).find((dif: Record<string, number>) => dif.target === diffSelected);
    }

    // Select Skill if required
    let skill:TwodsixItem|undefined = undefined;
    if (parsedSkills !== "" && parsedSkills !== 'None') {
      skill = actor.getBestSkill(parsedSkills, !char);
      if (!skill) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorLacksSkill").replace("_ACTOR_NAME_", actor.name ?? "").replace("_SKILL_", parsedSkills));
        return false;
      }
    }

    // get characteristic key (displayLabelShort), default to skill key if none specificed in formula
    let characteristicKey = "";
    const charObject = actor?.system["characteristics"] ?? {};
    //we need an array
    const charObjectArray = Object.values(charObject);
    if(!char && skill) {
      //Try to get characteristic key from skill
      characteristicKey = getKeyByValue(TWODSIX.CHARACTERISTICS, (<Skills>skill.system).characteristic);
    } else if (char) {
      //find the most advantageous characteristic to use based on the displayed (custom) short label
      const charOptions = char.split("|").map(str => str.trim());
      let candidateCharObject = undefined;
      const candidateCharObjects = charObjectArray.filter(ch => charOptions.includes(ch.displayShortLabel) || charOptions.includes(ch.shortLabel));
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
      skillRoll: parsedSkills === 'None' ? false : !!skill,
      displayLabel: displayLabel,
      rollModifiers: {
        characteristic: shortLabel,
        other: otherMod}
    };
    if (diff) {
      returnValues["difficulty"] = difficulty;
    }
    return returnValues;
  } else {
    ui.notifications.error("TWODSIX.Ship.CannotParseArgument", {localize: true});
    return false;
  }
}
