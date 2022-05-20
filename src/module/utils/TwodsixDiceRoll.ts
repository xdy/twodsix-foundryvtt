import {CE_DIFFICULTIES, CEL_DIFFICULTIES, TWODSIX} from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import {advantageDisadvantageTerm} from "../i18n";
import {getKeyByValue} from "./sheetUtils";
import {TwodsixRollSettings} from "./TwodsixRollSettings";
import {Crit} from "./crit";
import {Gear, Skills} from "../../types/template";
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
    this.woundedEffect = (<Traveller>this.actor.data.data)?.woundedEffect;

    this.createRoll();

    this.naturalTotal = this.roll?.dice[0].results.reduce((total:number, dice) => {
      return dice.active ? total + dice.result : total;
    }, 0) || 0;

    this.calculateEffect();
  }

  private createRoll():void {
    const difficultiesAsTargetNumber = game.settings.get('twodsix', 'difficultiesAsTargetNumber');
    const rollType = TWODSIX.ROLLTYPES[this.settings.rollType].formula;
    const data = {} as { skill:number, difficultyMod:number, DM:number, woundedEffect:number };

    let formula = rollType;

    // Add characteristic modifier
    if (this.settings.characteristic !== "NONE" && this.actor) {
      formula += ` + @${this.settings.characteristic}`;
      data[this.settings.characteristic] = this.actor.getCharacteristicModifier(this.settings.characteristic);
    }

    // Add skill modifier
    if (this.skill) {
      formula += "+ @skill";
      /*Check for "Untrained" value and use if better to account for JOAT*/
      const joat = (<Skills>this.actor?.getUntrainedSkill().data?.data)?.value ?? (<Skills>game.system.template?.Item?.skills)?.value;
      const aSkill = <Skills>this.skill.data.data;
      if (joat > aSkill.value) {
        data.skill = joat;
      } else {
        data.skill = aSkill.value;
      }
    }

    // Add dice modifier
    if (this.settings.diceModifier) { //TODO Not sure I like that auto-fire DM and 'skill DM' from the weapon get added, I prefer to 'show the math'
      formula += "+ @DM";
      data.DM = this.settings.diceModifier;
    }

    // Add difficulty modifier or set target
    if (!difficultiesAsTargetNumber) {
      formula += "+ @difficultyMod";
      data.difficultyMod = this.settings.difficulty.mod;
    }

    //Subtract Modifier for wound status
    if(game.settings.get('twodsix', 'useWoundedStatusIndicators') && this.woundedEffect < 0) {
      formula += "+ @woundedEffect";
      data.woundedEffect = this.woundedEffect;
    }

    this.roll = new Roll(formula, data).evaluate({async: false}); // async:true will be default in foundry 0.10
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

  public async sendToChat():Promise<void> {
    const rollingString = game.i18n.localize("TWODSIX.Rolls.Rolling");
    const usingString = game.i18n.localize("TWODSIX.Actor.using");
    const difficulties:CEL_DIFFICULTIES | CE_DIFFICULTIES = TWODSIX.DIFFICULTIES[(game.settings.get('twodsix', 'difficultyListUsed'))];
    const difficulty = game.i18n.localize(getKeyByValue(difficulties, this.settings.difficulty));

    let flavor = this.settings.extraFlavor ? this.settings.extraFlavor + `<br>`: ``;
    flavor += `${rollingString}: ${difficulty}`;

    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      flavor += `(${this.settings.difficulty.target}+)`;
    } else {
      const difficultyMod = TwodsixDiceRoll.addSign(this.roll?.data['difficultyMod']);
      flavor += `(${difficultyMod})`;
    }

    if (this.settings.rollType != TWODSIX.ROLLTYPES.Normal.key) {
      const rollType = advantageDisadvantageTerm(this.settings.rollType);
      flavor += ` ${game.i18n.localize("TWODSIX.Rolls.With")} ${rollType}`;
    }

    if (this.skill) {
      const skillValue = TwodsixDiceRoll.addSign((<Gear>this.roll?.data)?.skill);
      flavor += ` ${this.skill.data.name}(${skillValue})`;
    }

    if (this.item) {
      flavor += ` ${usingString} ${this.item.data.name}`;
    }

    if (this.roll?.data['DM']) {
      flavor += ` +DM(${TwodsixDiceRoll.addSign(this.roll?.data['DM'])})`;
    }

    if (this.roll?.data['woundedEffect']) {
      flavor += ` +${game.i18n.localize("TWODSIX.Rolls.Wounds")}(${this.roll?.data['woundedEffect']})`;
    }
    if (this.settings.characteristic !== 'NONE' && this.actor) { //TODO Maybe this should become a 'characteristic'? Would mean characteristic could be typed rather than a string...
      const characteristicValue = TwodsixDiceRoll.addSign(this.roll?.data[this.settings.characteristic]);
      const charShortName:string = this.settings.displayLabel;
      flavor += ` ${usingString} ${charShortName}(${characteristicValue})`;
    }

    // Add timeframe if requred
    let timeToComplete = ``;
    if (game.settings.get("twodsix", "showTimeframe")  && this.settings.selectedTimeUnit !== "none") {
      if (Roll.validate(this.settings.timeRollFormula)) {
        timeToComplete = new Roll(this.settings.timeRollFormula).evaluate({async: false}).total.toString() + ` ` + game.i18n.localize(TWODSIX.TimeUnits[this.settings.selectedTimeUnit]);
      }
    }

    await this.roll?.toMessage(
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
  }
}
