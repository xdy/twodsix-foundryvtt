// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {TWODSIX} from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import {advantageDisadvantageTerm} from "../i18n";
import {getKeyByValue} from "./sheetUtils";
import {TwodsixRollSettings} from "./TwodsixRollSettings";
import Crit from "./crit";
import { simplifySkillName } from "./utils";

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
      formula += this.rollSettings.difficulty.mod < 0 ? " - @difficultyMod" : " + @difficultyMod";
      formulaData.difficultyMod = this.rollSettings.difficulty.mod < 0 ? -this.rollSettings.difficulty.mod : this.rollSettings.difficulty.mod;
    }

    // Add skill modifier
    if (this.skill) {
      const skillValue = this.actor.system.skills[simplifySkillName(this.skill.name)];
      formula += skillValue < 0 ? " - @skillValue" : " + @skillValue";
      formulaData.skillValue = skillValue < 0 ? -skillValue : skillValue;
    }

    // Add chain modifier
    if (this.rollSettings.rollModifiers.chain) {
      formula += this.rollSettings.rollModifiers.chain < 0 ? " - @chain" : " + @chain";
      formulaData.chain = this.rollSettings.rollModifiers.chain < 0 ? -this.rollSettings.rollModifiers.chain : this.rollSettings.rollModifiers.chain;
    }

    // Add characteristic modifier
    if (this.rollSettings.rollModifiers.characteristic !== "NONE" && this.actor) {
      const charMod = this.actor.getCharacteristicModifier(this.rollSettings.rollModifiers.characteristic);
      formula += charMod < 0 ? ' - @characteristicModifier' : ' + @characteristicModifier';
      formulaData.characteristicModifier = charMod < 0 ? -charMod : charMod;
    }

    // Add item related modifiers
    if (this.rollSettings.itemRoll) {
      formula += this.rollSettings.rollModifiers.item < 0 ? " - @item": " + @item";
      formulaData.item = this.rollSettings.rollModifiers.item < 0 ? -this.rollSettings.rollModifiers.item : this.rollSettings.rollModifiers.item;

      if (this.rollSettings.rollModifiers.rof) {
        formula += this.rollSettings.rollModifiers.rof < 0 ? " - @rof": " + @rof";
        formulaData.rof = this.rollSettings.rollModifiers.rof < 0 ? -this.rollSettings.rollModifiers.rof : this.rollSettings.rollModifiers.rof;
      }
      if (this.rollSettings.rollModifiers.dodgeParry && game.settings.get("twodsix", "useDodgeParry")) {
        formula += this.rollSettings.rollModifiers.dodgeParry < 0 ? " - @dodgeParry": " + @dodgeParry";
        formulaData.dodgeParry = this.rollSettings.rollModifiers.dodgeParry < 0 ? -this.rollSettings.rollModifiers.dodgeParry : this.rollSettings.rollModifiers.dodgeParry;
      }
      if(this.rollSettings.rollModifiers.weaponsHandling !== 0) {
        formula += this.rollSettings.rollModifiers.weaponsHandling < 0 ? " - @weaponsHandling": " + @weaponsHandling";
        formulaData.weaponsHandling = this.rollSettings.rollModifiers.weaponsHandling < 0 ? -this.rollSettings.rollModifiers.weaponsHandling : this.rollSettings.rollModifiers.weaponsHandling;
      }
      if(this.rollSettings.rollModifiers.attachments !== 0) {
        formula += this.rollSettings.rollModifiers.attachments < 0 ? " - @attachments": " + @attachments";
        formulaData.attachments = this.rollSettings.rollModifiers.attachments < 0 ? -this.rollSettings.rollModifiers.attachments : this.rollSettings.rollModifiers.attachments;
      }
    }

    // Add other modifier
    if (this.rollSettings.rollModifiers.other) {
      formula += this.rollSettings.rollModifiers.other < 0 ? " - @DM" : " + @DM";
      formulaData.DM = this.rollSettings.rollModifiers.other < 0 ? -this.rollSettings.rollModifiers.other : this.rollSettings.rollModifiers.other;
    }

    //Subtract Modifier for wound status
    if(game.settings.get('twodsix', 'useWoundedStatusIndicators') && this.rollSettings.rollModifiers.wounds < 0) {
      formula += " - @woundedEffect";
      formulaData.woundedEffect = -this.rollSettings.rollModifiers.wounds;
    }

    //Subtract Modifier for encumbered status
    if(game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && this.rollSettings.rollModifiers.encumbered < 0) {
      formula += " - @encumberedEffect";
      formulaData.encumberedEffect = -this.rollSettings.rollModifiers.encumbered;
    }

    //Allow custom .mod effect
    if(this.rollSettings.rollModifiers.custom !== 0) {
      formula += this.rollSettings.rollModifiers.custom < 0 ? " - @customEffect": " + @customEffect";
      formulaData.customEffect = this.rollSettings.rollModifiers.custom < 0 ? -this.rollSettings.rollModifiers.custom : this.rollSettings.rollModifiers.custom;
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

  private static addSign(value:number):string {
    return `${value <= 0 ? "" : "+"}${value}`;
  }

  public async sendToChat(difficultyList: object):Promise<void> {
    const rollingString = game.i18n.localize("TWODSIX.Rolls.Rolling");
    const usingString = game.i18n.localize("TWODSIX.Actor.using");
    const difficulty = game.i18n.localize(getKeyByValue(difficultyList, this.rollSettings.difficulty));
    const showModifiers = game.settings.get('twodsix', "showModifierDetails");

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
      const difficultyMod = TwodsixDiceRoll.addSign(this.rollSettings.difficulty.mod);
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
      const skillValue = TwodsixDiceRoll.addSign(this.actor.system.skills[simplifySkillName(this.skill.name)]);
      flavorText += ` ${usingString} ${this.skill.name}` + (showModifiers ? `(${skillValue})` : ``) + ` ${game.i18n.localize("TWODSIX.itemTypes.skill")}`;
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.SkillModifier")}</td><td>${this.skill.name}</td><td class="centre">${skillValue}</td></tr>`;

      //Chain Roll
      if (this.rollSettings.rollModifiers.chain) {
        const chainValue = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.chain);
        flavorText += ` ${game.i18n.localize("TWODSIX.Chat.Roll.WithChainBonus")}` + (showModifiers ? `(${chainValue})` : ``);
        flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.ChainRoll")}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.Bonus")}</td><td class="centre">${chainValue}</td></tr>`;
      }
    }

    //Characterisitic Modifier
    if (this.rollSettings.rollModifiers.characteristic !== 'NONE' && this.actor) { //TODO Maybe this should become a 'characteristic'? Would mean characteristic could be typed rather than a string...
      const characteristicLabel = game.i18n.localize("TWODSIX.Rolls.characteristic");
      const characteristicValue = TwodsixDiceRoll.addSign(this.actor.getCharacteristicModifier(this.rollSettings.rollModifiers.characteristic));
      const charShortName:string = this.rollSettings.displayLabel;
      flavorText += (this.rollSettings.skillRoll ? ` &` : ` ${usingString}`) + ` ${charShortName}` + (showModifiers ? `(${characteristicValue})` : ``) + ` ${characteristicLabel}`;
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Characteristic")}</td><td>${charShortName}</td><td class="centre">${characteristicValue}</td></tr>`;
    }

    //Item & Attack Modifiers
    if (this.rollSettings.itemRoll) {
      const itemValue = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.item);
      flavorText += (this.rollSettings.skillRoll ? ` &` : ` ${usingString}`)   + ` ${this.rollSettings.itemName}` + (showModifiers ? `(${itemValue})` : ``);
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.ItemModifier")}</td><td>${this.rollSettings.itemName}</td><td class="centre">${itemValue}</td></tr>`;
      if (this.rollSettings.rollModifiers.attachments) {
        const attachments = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.attachments);
        flavorText += ` + ${game.i18n.localize("TWODSIX.Rolls.Attachments")}` + (showModifiers ? `(${attachments})` : ``);
        flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Attack")}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.Attachments")}</td><td class="centre">${attachments}</td></tr>`;
      }

      if (this.rollSettings.rollModifiers.rof) {
        const rofValue = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.rof);
        flavorText += ` + ${game.i18n.localize("TWODSIX.Rolls.ROF")}` + (showModifiers ? `(${rofValue})` : ``);
        flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Attack")}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.ROF")}</td><td class="centre">${rofValue}</td></tr>`;
      }
      if (this.rollSettings.rollModifiers.weaponsHandling) {
        const weaponsHandling = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.weaponsHandling);
        flavorText += ` + ${game.i18n.localize("TWODSIX.Rolls.WeaponsHandling")}` + (showModifiers ? `(${weaponsHandling})` : ``);
        flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Attack")}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.WeaponsHandling")}</td><td class="centre">${weaponsHandling}</td></tr>`;
      }
      if (this.rollSettings.rollModifiers.dodgeParry && game.settings.get("twodsix", "useDodgeParry")) {
        const dodgeParryValue = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.dodgeParry);
        flavorText += ` + ${game.i18n.localize("TWODSIX.Rolls.DodgeParry")}` + (showModifiers ? `(${dodgeParryValue})` : ``);
        flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Attack")}</td><td>${game.i18n.localize("TWODSIX.Rolls.DodgeParry")}</td><td class="centre">${dodgeParryValue}</td></tr>`;
      }
    }

    //Custom Modifier
    if (this.rollSettings.rollModifiers.other !== 0) {
      const customDM = TwodsixDiceRoll.addSign(this.rollSettings.rollModifiers.other);
      flavorText += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.Custom")}` + (showModifiers ? `(${customDM})` : ``);
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Custom")}</td><td>&mdash;</td><td class="centre">${customDM}</td></tr>`;
    }

    //Condition Modifiers
    if (this.rollSettings.rollModifiers.wounds !== 0) {
      flavorText += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.Wounds")}` + (showModifiers ? `(${this.rollSettings.rollModifiers.wounds})` : ``);
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Condition")}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.Wounds")}</td><td class="centre">${this.rollSettings.rollModifiers.wounds}</td></tr>`;
    }
    if (this.rollSettings.rollModifiers.encumbered !== 0) {
      flavorText += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.Encumbered")}` + (showModifiers ? `(${this.rollSettings.rollModifiers.encumbered})` : ``);
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.Condition")}</td><td>${game.i18n.localize("TWODSIX.Chat.Roll.Encumbered")}</td><td class="centre">${this.rollSettings.rollModifiers.encumbered}</td></tr>`;
    }
    if (this.rollSettings.rollModifiers.custom !== 0) {
      flavorText += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.ActiveEffect")}`+ (showModifiers ? `(${this.rollSettings.rollModifiers.custom})` : ``);
      flavorTable += `<tr><td>${game.i18n.localize("TWODSIX.Chat.Roll.ActiveEffect")}</td><td>${this.rollSettings.rollModifiers.customLabel}</td><td class="centre">${this.rollSettings.rollModifiers.custom}</td></tr>`;
    }
    flavorText +=`</p>`;

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

    //Add buttons
    flavorText += `<section class="card-buttons"><button data-action="expand" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.ToggleDetails")}"><i class="fa-solid fa-circle-question"></i></button>`;
    if (this.isSuccess() && !game.settings.get("twodsix", "automateDamageRollOnHit") && (this.item?.type === "weapon" || (this.item?.type === "component" && this.item?.system?.subtype === "armament"))) {
      flavorText += `<button data-action="damage" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollDamage")}"><i class="fa-solid fa-person-burst"></i></button>`;
    } else if (this.rollSettings.skillRoll && this.item?.type !== "weapon" && !(this.item?.type === "component" && this.item?.system?.subtype === "armament")) {
      flavorText += `<button data-action="chain" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollChain")}"><i class="fa-solid fa-link"></i></button>`;
      flavorText += `<button data-action="opposed" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollOpposed")}"><i class="fa-solid fa-down-left-and-up-right-to-center"></i></button>`;
    }

    flavorText +=`</section></section>`;
    flavorTable += `</table>`;

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
