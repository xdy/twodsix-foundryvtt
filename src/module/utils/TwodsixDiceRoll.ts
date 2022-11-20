// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {TWODSIX} from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import {advantageDisadvantageTerm} from "../i18n";
import {getKeyByValue} from "./sheetUtils";
import {TwodsixRollSettings} from "./TwodsixRollSettings";
import Crit from "./crit";
import { Traveller } from "../../types/template";

export class TwodsixDiceRoll {
  settings:TwodsixRollSettings;
  actor:TwodsixActor;
  skill?:TwodsixItem | null;
  item?:TwodsixItem | null;
  target:number;
  naturalTotal:number;
  effect:number;
  roll:Roll | null = null;
  woundedEffect:number;

  constructor(settings:TwodsixRollSettings, actor:TwodsixActor, skill:TwodsixItem | null = null, item:TwodsixItem | null = null) {
    this.settings = settings;
    this.actor = actor;
    this.skill = skill;
    this.item = item;
    this.woundedEffect = (<Traveller>this.actor.system)?.woundedEffect;

    this.createRoll();

    this.naturalTotal = this.roll?.dice[0].results.reduce((total:number, dice) => {
      return dice.active ? total + dice.result : total;
    }, 0) || 0;

    this.calculateEffect();
  }

  private createRoll():void {
    const difficultiesAsTargetNumber = game.settings.get('twodsix', 'difficultiesAsTargetNumber');
    const rollType = TWODSIX.ROLLTYPES[this.settings.rollType].formula;
    const formulaData = {};

    let formula = rollType;
    // Add difficulty modifier or set target
    if (!difficultiesAsTargetNumber) {
      formula += this.settings.difficulty.mod < 0 ? " - @difficultyMod" : " + @difficultyMod";
      formulaData.difficultyMod = this.settings.difficulty.mod < 0 ? -this.settings.difficulty.mod : this.settings.difficulty.mod;
    }

    // Add skill modifier
    if (this.settings.skillRoll) {
      formula += this.settings.rollModifiers.skill < 0 ? " - @skill" : " + @skill";
      formulaData.skill = this.settings.rollModifiers.skill < 0 ? -this.settings.rollModifiers.skill : this.settings.rollModifiers.skill;
    }

    // Add characteristic modifier
    if (this.settings.rollModifiers.characteristic !== "NONE" && this.actor) {
      const charMod = this.actor.getCharacteristicModifier(this.settings.rollModifiers.characteristic);
      formula += charMod < 0 ? ' - @characteristicModifier' : ' + @characteristicModifier';
      formulaData.characteristicModifier = charMod < 0 ? -charMod : charMod;
    }

    // Add item related modifiers
    if (this.settings.itemRoll) {
      formula += this.settings.rollModifiers.item < 0 ? " - @item": " + @item";
      formulaData.item = this.settings.rollModifiers.item < 0 ? -this.settings.rollModifiers.item : this.settings.rollModifiers.item;

      if (this.settings.rollModifiers.rof) {
        formula += this.settings.rollModifiers.rof < 0 ? " - @rof": " + @rof";
        formulaData.rof = this.settings.rollModifiers.rof < 0 ? -this.settings.rollModifiers.rof : this.settings.rollModifiers.rof;
      }
      if (this.settings.rollModifiers.dodgeParry && game.settings.get("twodsix", "useDodgeParry")) {
        formula += this.settings.rollModifiers.dodgeParry < 0 ? " - @dodgeParry": " + @dodgeParry";
        formulaData.dodgeParry = this.settings.rollModifiers.dodgeParry < 0 ? -this.settings.rollModifiers.dodgeParry : this.settings.rollModifiers.dodgeParry;
      }
    }

    // Add other modifier
    if (this.settings.rollModifiers.other) {
      formula += this.settings.rollModifiers.other < 0 ? " - @DM" : " + @DM";
      formulaData.DM = this.settings.rollModifiers.other < 0 ? -this.settings.rollModifiers.other : this.settings.rollModifiers.other;
    }

    //Subtract Modifier for wound status
    if(game.settings.get('twodsix', 'useWoundedStatusIndicators') && this.settings.rollModifiers.wounds < 0) {
      formula += " - @woundedEffect";
      formulaData.woundedEffect = -this.settings.rollModifiers.wounds;
    }

    //Subtract Modifier for wound status
    if(game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && this.settings.rollModifiers.encumbered < 0) {
      formula += " - @encumberedEffect";
      formulaData.encumberedEffect = -this.settings.rollModifiers.encumbered;
    }

    //Allow custom .mod effect
    if(this.settings.rollModifiers.custom !== 0) {
      formula += this.settings.rollModifiers.custom < 0 ? " - @customEffect": " + @customEffect";
      formulaData.customEffect = this.settings.rollModifiers.custom < 0 ? -this.settings.rollModifiers.custom : this.settings.rollModifiers.custom;
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
      effect = (this.roll?.total || 0) - this.settings.difficulty.target;
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
    const difficulty = game.i18n.localize(getKeyByValue(difficultyList, this.settings.difficulty));

    let flavor = this.settings.extraFlavor ? this.settings.extraFlavor + `<br>`: ``;
    flavor += `${rollingString}: ${difficulty}`;

    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      flavor += `(${this.settings.difficulty.target}+)`;
    } else {
      const difficultyMod = TwodsixDiceRoll.addSign(this.settings.difficulty.mod);
      flavor += `(${difficultyMod})`;
    }

    if (this.settings.rollType != TWODSIX.ROLLTYPES.Normal.key) {
      const rollType = advantageDisadvantageTerm(this.settings.rollType);
      flavor += ` ${game.i18n.localize("TWODSIX.Rolls.With")} ${rollType}`;
    }

    if (this.settings.skillRoll) {
      const skillValue = TwodsixDiceRoll.addSign(this.settings.rollModifiers.skill);
      flavor += ` ${usingString} ${this.settings.skillName}(${skillValue}) ${game.i18n.localize("TWODSIX.itemTypes.skill")}`;
    }

    if (this.settings.rollModifiers.characteristic !== 'NONE' && this.actor) { //TODO Maybe this should become a 'characteristic'? Would mean characteristic could be typed rather than a string...
      const characteristicLabel = game.i18n.localize("TWODSIX.Rolls.characteristic");
      const characteristicValue = TwodsixDiceRoll.addSign(this.actor.getCharacteristicModifier(this.settings.rollModifiers.characteristic));
      const charShortName:string = this.settings.displayLabel;
      flavor += this.settings.skillRoll ? ` & ${charShortName}(${characteristicValue}) ${characteristicLabel}` : ` ${usingString} ${charShortName}(${characteristicValue}) ${characteristicLabel}`;
    }

    if (this.settings.itemRoll) {
      const itemValue = TwodsixDiceRoll.addSign(this.settings.rollModifiers.item);
      flavor += this.settings.skillRoll ? ` & ${this.settings.itemName}(${itemValue})` : ` ${usingString} ${this.settings.itemName}(${itemValue})`;

      if (this.settings.rollModifiers.rof) {
        flavor += ` + ${game.i18n.localize("TWODSIX.Rolls.ROF")} (${TwodsixDiceRoll.addSign(this.settings.rollModifiers.rof)})`;
      }
      if (this.settings.rollModifiers.dodgeParry && game.settings.get("twodsix", "useDodgeParry")) {
        flavor += ` + ${game.i18n.localize("TWODSIX.Rolls.DodgeParry")} (${TwodsixDiceRoll.addSign(this.settings.rollModifiers.dodgeParry)})`;
      }
    }

    if (this.settings.rollModifiers.other !== 0) {
      flavor += ` + Custom DM(${TwodsixDiceRoll.addSign(this.settings.rollModifiers.other)})`;
    }

    if (this.settings.rollModifiers.wounds !== 0) {
      flavor += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.Wounds")}(${this.settings.rollModifiers.wounds})`;
    }
    if (this.settings.rollModifiers.encumbered !== 0) {
      flavor += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.Encumbered")}(${this.settings.rollModifiers.encumbered})`;
    }
    if (this.settings.rollModifiers.custom !== 0) {
      flavor += ` + ${game.i18n.localize("TWODSIX.Chat.Roll.Custom")}(${this.settings.rollModifiers.custom})`;
    }

    // Add timeframe if requred
    let timeToComplete = ``;
    if (game.settings.get("twodsix", "showTimeframe")  && this.settings.selectedTimeUnit !== "none") {
      if (Roll.validate(this.settings.timeRollFormula)) {
        timeToComplete = new Roll(this.settings.timeRollFormula).evaluate({async: false}).total.toString() + ` ` + game.i18n.localize(TWODSIX.TimeUnits[this.settings.selectedTimeUnit]);
      }
    }

    const msg = await this.roll?.toMessage(
      {
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        flavor: flavor,
        rollMode: this.settings.rollMode,
        flags: {
          "core.canPopout": true,
          "twodsix.crit": this.getCrit(),
          "twodsix.effect": this.effect,
          "twodsix.timeframe": timeToComplete
        }
      },
      {rollMode: this.settings.rollMode}
    );
    if (game.modules.get("dice-so-nice")?.active) {
      await game.dice3d.waitFor3DAnimationByMessageID(msg.id);
    }
  }
}
