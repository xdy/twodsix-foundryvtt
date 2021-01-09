import {Crit} from "../../types/twodsix";
import {TWODSIX} from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import {advantageDisadvantageTerm} from "../i18n";
import {getKeyByValue} from "./sheetUtils";
import {TwodsixRollSettings} from "./TwodsixRollSettings";

export class TwodsixDiceRoll {
  settings: TwodsixRollSettings;
  actor: TwodsixActor;
  skill?: TwodsixItem;
  item?: TwodsixItem;
  target: number;
  naturalTotal: number;
  effect: number;
  roll: Roll;

  constructor (settings: TwodsixRollSettings, actor: TwodsixActor, skill: TwodsixItem=null, item: TwodsixItem=null) {
    this.settings = settings;
    this.actor = actor;
    this.skill = skill;
    this.item = item;

    this.createRoll();

    this.naturalTotal = this.roll.dice[0].results.reduce((total:number, dice) => {
      return dice["active"] ? total + dice["result"] : total;
    }, 0);

    this.calculateEffect();
  }

  private createRoll(): void {
    const difficultiesAsTargetNumber = game.settings.get('twodsix', 'difficultiesAsTargetNumber');
    const rollType = TWODSIX.ROLLTYPES[this.settings.rollType].formula;
    const data = {} as {string:number};

    let formula = `${rollType}`;

    // Add characteristic modifier
    if (this.settings.characteristic !== "NONE") {
      formula += ` + @${this.settings.characteristic}`;
      data[this.settings.characteristic] = this.actor.getCharacteristicModifier(this.settings.characteristic);
    }

    // Add skill modifier
    if (this.skill) {
      formula += "+ @skill";
      data["skill"] = this.skill.data.data.value;
    }

    // Add dice modifier
    if (this.settings.diceModifier) { //TODO Not sure I like that auto-fire DM and 'skill DM' from the weapon get added, I prefer to 'show the math'
      formula += "+ @DM";
      data["DM"] = this.settings.diceModifier;
    }

    // Add difficulty modifier or set target
    if (!difficultiesAsTargetNumber) {
      formula += "+ @difficultyMod";
      data["difficultyMod"] = this.settings.difficulty.mod;
    }

    this.roll = new Roll(formula, data).roll();
  }

  public getCrit(): Crit {
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
    let effect = this.roll.total - this.settings.difficulty.target;
    if (this.isNaturalCritSuccess()) {
      console.log(`Got a natural 12 with Effect ${effect}!`);
      if (effect >= 0 && game.settings.get('twodsix', 'criticalNaturalAffectsEffect')) {
        console.log("Setting Effect to -1 due to natural 2!");
        effect = -1;
      }
    } else if (this.isNaturalCritFail()) {
      console.log(`Got a natural 2 with Effect ${effect}!`);
      if (effect < 0 && game.settings.get('twodsix', 'criticalNaturalAffectsEffect')) {
        console.log("Setting Effect to 0 due to natural 12!");
        effect = 0;
      }
    }
    this.effect = effect;
  }

  public async sendToChat():Promise<void> {
    const rollingString = game.i18n.localize("TWODSIX.Rolls.Rolling");
    const usingString = game.i18n.localize("TWODSIX.Actor.using");
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    const difficulty = game.i18n.localize(getKeyByValue(difficulties, this.settings.difficulty));

    let flavor = `${rollingString}: ${difficulty}`;

    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      flavor += `(${this.settings.difficulty.target}+)`;
    }

    if (this.settings.rollType != TWODSIX.ROLLTYPES.Normal.key) {
      const rollType = advantageDisadvantageTerm(this.settings.rollType);
      flavor += ` ${game.i18n.localize("TWODSIX.Rolls.With")} ${rollType}`;
    }

    if (this.skill) {
      const skillValue = this.skill.data.data.value;
      flavor += ` ${this.skill.data.name}(${skillValue <= 0 ? "" : "+"}${skillValue})`;
    }

    if (this.item) {
      flavor += ` ${usingString} ${this.item.data.name}`;
    }

    if (this.roll.data.DM) {
      flavor += ` +DM(${this.roll.data.DM <= 0 ? "" : "+"}${this.roll.data.DM})`;
    }

    if (this.settings.characteristic !== 'NONE') { //TODO Maybe this should become a 'characteristic'? Would mean characteristic could be typed rather than a string...
      const characteristicValue = this.roll.data[this.settings.characteristic];
      flavor += ` ${usingString} ${this.settings.characteristic}(${characteristicValue <= 0 ? "" : "+"}${characteristicValue})`;
    }

    await this.roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        flavor: flavor,
        rollType: this.settings.rollType,
        flags: {
          "core.canPopout": true,
          "twodsix.crit": this.getCrit(),
          "twodsix.effect": this.effect
        }
      },
      {rollMode: this.settings.rollMode}
    );
  }
}
