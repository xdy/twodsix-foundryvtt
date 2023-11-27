// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {TWODSIX} from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import {advantageDisadvantageTerm} from "../i18n";
import {getKeyByValue} from "./sheetUtils";
import {TwodsixRollSettings} from "./TwodsixRollSettings";
import Crit from "./crit";
import { simplifySkillName, addSign, capitalizeFirstLetter } from "./utils";

export class TwodsixDiceRoll {
  rollSettings:TwodsixRollSettings;
  actor:TwodsixActor;
  skill?:TwodsixItem | null;
  item?:TwodsixItem | null;
  target:number;
  naturalTotal:number;
  effect:number;
  roll:Roll | null = null;
  woundedEffect:number;
  modifierList:string[] | null;

  constructor(rollSettings:TwodsixRollSettings, actor:TwodsixActor, skill:TwodsixItem | null = null, item:TwodsixItem | null = null) {
    this.rollSettings = rollSettings;
    this.actor = actor;
    this.skill = rollSettings.rollModifiers.selectedSkill ? fromUuidSync(rollSettings.rollModifiers.selectedSkill) : skill;
    this.item = item;

    this.createRoll();

    this.naturalTotal = this.roll?.dice[0].results.reduce((total:number, dice) => {
      return dice.active ? total + dice.result : total;
    }, 0) || 0;

    this.calculateEffect();
  }

  private createRoll():void {
    const difficultiesAsTargetNumber = game.settings.get('twodsix', 'difficultiesAsTargetNumber');
    const rollType = TWODSIX.ROLLTYPES[this.rollSettings.rollType].formula;
    const formulaData = {};

    let formula = rollType;
    // Add difficulty modifier or set target
    if (!difficultiesAsTargetNumber) {
      formula += `${getOperatorString(this.rollSettings.difficulty.mod)} @difficultyMod`;
      formulaData.difficultyMod = Math.abs(this.rollSettings.difficulty.mod);
    }

    // Add skill modifier
    if (this.skill) {
      let skillValue = this.actor.system.skills[simplifySkillName(this.skill.name)];
      if (this.rollSettings.rollModifiers.skillLevelMax) {
        skillValue = Math.min(skillValue, this.rollSettings.rollModifiers.skillLevelMax);
      }
      formula += `${getOperatorString(skillValue)} @skillValue`;
      formulaData.skillValue = Math.abs(skillValue);
      formulaData.actualSkillValue = skillValue; //needed to enforce clamp value in description
    }
    // Process rollModifiers
    this.modifierList = this.getRollModifierList();

    for (const modifierName of this.modifierList) {
      let modifierValue = 0;
      if (modifierName === "characteristic") {
        modifierValue = this.actor.getCharacteristicModifier(this.rollSettings.rollModifiers[modifierName]);
      } else {
        modifierValue = this.rollSettings.rollModifiers[modifierName];
      }
      formula += `${getOperatorString(modifierValue)} @${modifierName}`;
      formulaData[modifierName] = Math.abs(modifierValue);
    }

    this.roll = new Roll(formula, formulaData).evaluate({async: false}); // async:true will be default in foundry 0.10
  }

  public getCrit():Crit {
    const CRITICAL_EFFECT_VALUE = game.settings.get('twodsix', 'absoluteCriticalEffectValue');
    if (this.isNaturalCritSuccess()) {
      return Crit.success;
    } else if (this.isNaturalCritFail()) {
      return Crit.fail;
    } else if (this.effect >= CRITICAL_EFFECT_VALUE) {
      return Crit.success;
    } else if (this.effect <= -CRITICAL_EFFECT_VALUE) {
      return Crit.fail;
    }
    return Crit.neither;
  }

  private isNaturalCritSuccess():boolean {
    return this.naturalTotal == 12;
  }

  private isNaturalCritFail():boolean {
    return this.naturalTotal == 2;
  }

  public isSuccess():boolean {
    return this.effect >= 0;
  }

  private calculateEffect():void {
    let effect;
    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      effect = (this.roll?.total || 0) - this.rollSettings.difficulty.target;
    } else {
      effect = (this.roll?.total || 0) - TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))].Average.target;
    }

    if (this.isNaturalCritSuccess()) {
      console.log(`Got a natural 12 with Effect ${effect}!`);
      if (effect < 0 && game.settings.get('twodsix', 'criticalNaturalAffectsEffect')) {
        console.log("Setting Effect to 0 due to natural 12!");
        effect = 0;
      }
    } else if (this.isNaturalCritFail()) {
      console.log(`Got a natural 2 with Effect ${effect}!`);
      if (effect >= 0 && game.settings.get('twodsix', 'criticalNaturalAffectsEffect')) {
        console.log("Setting Effect to -1 due to natural 2!");
        effect = -1;
      }
    }
    this.effect = effect;
  }

  public getDegreeOfSuccess(): string {
    //Check for override for natural 2 or 12
    if (game.settings.get("twodsix", 'overrideSuccessWithNaturalCrit')) {
      if (this.naturalTotal === 2) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.ExceptionalFailure");
      } else if (this.naturalTotal === 12) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.ExceptionalSuccess");
      }
    }

    if (game.settings.get("twodsix", 'useDegreesOfSuccess') === "CE") {
      if (this.effect <= -6) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.ExceptionalFailure");
      } else if (this.effect <= -1 ) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.Failure");
      } else if (this.effect <= 5 ){
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.Success");
      } else if (this.effect >= 6) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.ExceptionalSuccess");
      } else {
        return "";
      }
    } else if (game.settings.get("twodsix", 'useDegreesOfSuccess') === "other"){
      if (this.effect <= -6) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.ExceptionalFailure");
      } else if (this.effect <= -2 ) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.AverageFailure");
      } else if (this.effect === -1 ) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.MarginalFailure");
      } else if (this.effect === 0 ) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.MarginalSuccess");
      } else if (this.effect <= 5 ){
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.AverageSuccess");
      } else if (this.effect >= 6) {
        return game.i18n.localize("TWODSIX.Chat.Roll.DegreesOfSuccess.ExceptionalSuccess");
      } else {
        return "";
      }
    } else {
      return "";
    }
  }

  public getRollModifierList(): string[] {
    const returnValue = [];
    // Add chain modifier
    if (this.rollSettings.rollModifiers.chain) {
      returnValue.push("chain");
    }

    // Add characteristic modifier
    if (this.rollSettings.rollModifiers.characteristic !== "NONE" && this.actor) {
      returnValue.push("characteristic");
    }

    // Add item related modifiers
    if (this.rollSettings.itemRoll) {
      returnValue.push("item");
      if (this.rollSettings.rollModifiers.rof) {
        returnValue.push("rof");
      }
      if (this.rollSettings.rollModifiers.dodgeParry !== 0) {
        returnValue.push("dodgeParry");
      }
      if(this.rollSettings.rollModifiers.weaponsHandling !== 0) {
        returnValue.push("weaponsHandling");
      }
      if(this.rollSettings.rollModifiers.weaponsRange !== 0) {
        returnValue.push("weaponsRange");
      }
      if(this.rollSettings.rollModifiers.attachments !== 0) {
        returnValue.push("attachments");
      }
    }

    // Add other modifier
    if (this.rollSettings.rollModifiers.other) {
      returnValue.push("other");
    }

    //wound status
    if(game.settings.get('twodsix', 'useWoundedStatusIndicators') && this.rollSettings.rollModifiers.wounds < 0) {
      returnValue.push("wounds");
    }

    //encumbered status
    if(game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && this.rollSettings.rollModifiers.encumbered < 0) {
      returnValue.push("encumbered");
    }

    return returnValue;
  }

  public async sendToChat(difficultyList: object):Promise<void> {
    const rollingString: string = game.i18n.localize("TWODSIX.Rolls.Rolling");
    const usingString:string = game.i18n.localize("TWODSIX.Actor.using");
    const difficulty = game.i18n.localize(getKeyByValue(difficultyList, this.rollSettings.difficulty));
    const showModifiers: boolean = game.settings.get('twodsix', "showModifierDetails");

    //Initialize flavor strings
    let flavorText = ``;
    if (this.rollSettings.itemRoll && this.item?.img) {
      flavorText += `<section style="align-self: center;"><img src=${this.item.img} class="chat-image"></section>`;
    } else if (this.rollSettings.skillRoll && this.skill?.img) {
      flavorText += `<section style="align-self: center;"><img src=${this.skill.img} class="chat-image"></section>`;
    }
    let flavorTable = `<table><tr><th>${game.i18n.localize("TWODSIX.Chat.Roll.Modifier")}</th><th>${game.i18n.localize("TWODSIX.Chat.Roll.Description")}</th><th class="centre">${game.i18n.localize("TWODSIX.Chat.Roll.DM")}</th></tr>`;

    //Difficulty Text
    flavorText += `<section><p><b>${rollingString}</b>: ${difficulty}`;
    flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Difficulty")}</td><td>${difficulty}</td>`;
    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      flavorText += showModifiers ? `(${this.rollSettings.difficulty.target}+)` : ``;
      flavorTable += `<td class="centre">${this.rollSettings.difficulty.target}+</td></tr>`;
    } else {
      const difficultyMod = addSign(this.rollSettings.difficulty.mod);
      flavorText += showModifiers ? `(${difficultyMod})` : ``;
      flavorTable += `<td class="centre">${difficultyMod}</td></tr>`;
    }

    //Roll Type
    if (this.rollSettings.rollType != TWODSIX.ROLLTYPES.Normal.key) {
      const rollType = advantageDisadvantageTerm(this.rollSettings.rollType);
      flavorText += ` ${game.i18n.localize("TWODSIX.Rolls.With")} ${rollType}`;
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Type")}</td><td>${rollType}</td><td class="centre">&mdash;</td></tr>`;
    }

    //Skill Level
    if (this.skill) {
      const skillValue = addSign(this.roll.data.actualSkillValue); //Allow for clamp of level
      flavorText += ` ${usingString} ${this.skill.name}` + (showModifiers ? `(${skillValue})` : ``) + ` ${game.i18n.localize("TWODSIX.itemTypes.skill")}`;
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.SkillModifier")}</td><td>${this.skill.name}</td><td class="centre">${skillValue}</td></tr>`;

    }

    for (const modifierName of this.modifierList) {
      const description:string = game.i18n.localize(`TWODSIX.Chat.Roll.${capitalizeFirstLetter(modifierName)}`);
      if (modifierName === "characteristic") {
        const characteristicValue:string = addSign(this.actor.getCharacteristicModifier(this.rollSettings.rollModifiers.characteristic));
        const charShortName:string = this.rollSettings.displayLabel;
        flavorText += (this.rollSettings.skillRoll ? ` &` : ` ${usingString}`) + ` ${charShortName}` + (showModifiers ? `(${characteristicValue})` : ``) + ` ${description}`;
        flavorTable += `<tr><td>${description}</td><td>${charShortName}</td><td class="centre">${characteristicValue}</td></tr>`;
      } else {
        switch (modifierName) {
          case "item":
            flavorText += (this.rollSettings.skillRoll ? ` &` : ` ${usingString}`)   + ` ${this.rollSettings.itemName}`;
            flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.ItemModifier")}</td><td>${this.rollSettings.itemName}</td>`;
            break;
          case "chain":
            flavorText += ` ${game.i18n.localize("TWODSIX.Chat.Roll.WithChainBonus")}`;
            flavorTable += `<tr><td>${description}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.Bonus")}</td>`;
            break;
          case "attachments":
          case "rof":
          case "weaponsHandling":
          case "weaponsRange":
          case "dodgeParry":
            flavorText += ` + ${description}`;
            flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Attack")}</td><td>${description}</td>`;
            break;
          case "wounds":
          case "encumbered":
            flavorText += ` + ${description}`;
            flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Condition")}</td><td>${description}</td>`;
            break;
          case "other":
            flavorText += ` + ${description}`;
            flavorTable += `<tr><td>${description}</td><td>&mdash;</td>`;
            break;
          default:
            break;
        }
        const modValue = addSign(this.rollSettings.rollModifiers[modifierName]);
        flavorText += showModifiers ? `(${modValue})` : ``;
        flavorTable += `<td class="centre">${modValue}</td></tr>`;
      }
    }
    flavorText +=`</p>`;
    flavorTable += `</table>`;

    //Show applied active effects
    if (this.rollSettings.rollModifiers.appliedEffects.length > 0 && showModifiers) {
      flavorTable += `<section style="margin-top: 1em;">${game.i18n.localize("TWODSIX.ActiveEffects.IncludingEffects")}</section>`;
      flavorTable += `<table><tr><th>${game.i18n.localize("TWODSIX.ActiveEffects.Source")}</th><th>${game.i18n.localize("TWODSIX.Chat.Roll.Modifier")}</th><th>${game.i18n.localize("TWODSIX.Chat.Roll.DM")}</th></tr>`;
      for (const appliedAE of this.rollSettings.rollModifiers.appliedEffects) {
        flavorTable += `<tr><td>${appliedAE.name}</td><td>${appliedAE.stat}</td><td class="centre">${appliedAE.value}</td></tr>`;
      }
      flavorTable += `</table>`;
    }

    //add features
    if (this.rollSettings.itemRoll && this.item?.system?.features !== ""  && this.item?.system.features && game.settings.get("twodsix", "showFeaturesInChat")) {
      flavorText += `<p><b>${game.i18n.localize("TWODSIX.Items.Weapon.Features")}</b>: ${this.item.system.features}</p>`;
    }

    // Add timeframe if requred
    let timeToComplete = ``;
    if (game.settings.get("twodsix", "showTimeframe")  && this.rollSettings.selectedTimeUnit !== "none") {
      if (Roll.validate(this.rollSettings.timeRollFormula)) {
        timeToComplete = new Roll(this.rollSettings.timeRollFormula).evaluate({async: false}).total.toString() + ` ` + game.i18n.localize(TWODSIX.TimeUnits[this.rollSettings.selectedTimeUnit]);
      }
    }
    // Add degree of Success
    let degreeOfSuccess = ``;
    if (!["Attack", "ShipWeapon", "Unknown"].includes(this.rollSettings.flags.rollClass) && game.settings.get('twodsix', 'useDegreesOfSuccess') !== 'none') {
      degreeOfSuccess = this.getDegreeOfSuccess();
    }

    //Add buttons
    flavorText += `<section class="card-buttons"><button data-action="expand" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.ToggleDetails")}"><i class="fa-solid fa-circle-question" style="margin-left: 3px;"></i></button>`;
    if (this.isSuccess() && !game.settings.get("twodsix", "automateDamageRollOnHit") && (this.item?.type === "weapon" || (this.item?.type === "component" && this.item?.system?.subtype === "armament"))) {
      flavorText += `<button data-action="damage" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollDamage")}"><i class="fa-solid fa-person-burst" style="margin-left: 3px;"></i></button>`;
    } else if (this.rollSettings.skillRoll && this.item?.type !== "weapon" && !(this.item?.type === "component" && this.item?.system?.subtype === "armament")) {
      flavorText += `<button data-action="chain" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollChain")}"><i class="fa-solid fa-link" style="margin-left: 3px;"></i></button>`;
      flavorText += `<button data-action="opposed" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollOpposed")}"><i class="fa-solid fa-down-left-and-up-right-to-center" style="margin-left: 3px;"></i></button>`;
    }

    flavorText +=`</section></section>`;

    const flavor = (this.rollSettings.extraFlavor ? `<section>${this.rollSettings.extraFlavor}</section>`: ``) + `<section class="flavor-message"><section class="flavor-line">`+ flavorText + `</section><section class="dice-chattip" style="display: none;">` + flavorTable + `</section></section>`;

    await this.roll?.toMessage(
      {
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [this.roll],
        flavor: flavor,
        rollMode: this.rollSettings.rollMode,
        flags: {
          "core.canPopout": true,
          "twodsix.crit": this.getCrit(),
          "twodsix.effect": this.effect,
          "twodsix.degreeOfSuccess": degreeOfSuccess,
          "twodsix.timeframe": timeToComplete,
          "twodsix.itemUUID": this.rollSettings.flags.itemUUID ?? "",
          "twodsix.tokenUUID": this.rollSettings.flags.tokenUUID ?? "",
          "twodsix.rollClass": this.rollSettings.flags.rollClass ?? "",
          "twodsix.actorUUID": this.rollSettings.flags.actorUUID ?? "",
          "twodsix.bonusDamage": this.rollSettings.flags.bonusDamage ?? "",
        }
      },
      {rollMode: this.rollSettings.rollMode}
    );
  }
}

/**
 * Returns roll formula operator (+/-) depending on input value
 * @param {number} value
 * @returns {string} the string as ` + ` or ` - `
 */
function getOperatorString(value: number):string {
  if (isNaN(value)) {
    return ``;
  } else if (value < 0) {
    return ` -`;
  } else {
    return ` +`;
  }
}
