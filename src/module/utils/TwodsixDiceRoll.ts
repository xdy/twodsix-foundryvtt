import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import { advantageDisadvantageTerm } from "../i18n";
import { getKeyByValue } from "./sheetUtils";
import { TwodsixRollSettings } from "./TwodsixRollSettings";
import { Crit } from "./crit";
import { getCharShortName } from "../settings";

export class TwodsixDiceRoll {
  settings: TwodsixRollSettings;
  actor: TwodsixActor;
  skill?: TwodsixItem;
  item?: TwodsixItem;
  target: number;
  naturalTotal: number;
  effect: number;
  roll: Roll;

  constructor(settings: TwodsixRollSettings, actor: TwodsixActor, skill: TwodsixItem = null, item: TwodsixItem = null) {
    this.settings = settings;
    this.actor = actor;
    this.skill = skill;
    this.item = item;

    this.createRoll();

    this.naturalTotal = this.roll.dice[0].results.reduce((total: number, dice) => {
      return dice["active"] ? total + dice["result"] : total;
    }, 0);

    this.calculateEffect();
  }

  private createRoll(): void {
    const difficultiesAsTargetNumber = game.settings.get('twodsix', 'difficultiesAsTargetNumber');
    const rollType = TWODSIX.ROLLTYPES[this.settings.rollType].formula;
    const data = {} as { string: number };

    let formula = rollType;

    // Add characteristic modifier
    if (this.settings.characteristic !== "NONE") {
      formula += ` + @${this.settings.characteristic}`;
      data[this.settings.characteristic] = this.actor.getCharacteristicModifier(this.settings.characteristic);
    }

    // Add skill modifier
    if (this.skill) {
      formula += "+ @skill";
      /*Check for "Untrained" value and use if better to account for JOAT*/
      const joat = this.actor.getUntrainedSkill().data.data.value ?? game.system.template.Item.skills.value;
      if (joat > this.skill.data.data.value) {
        data["skill"] = joat;
      } else {
        data["skill"] = this.skill.data.data.value;
      }
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

    // @ts-ignore
    this.roll = new Roll(formula, data).evaluate({async: false}); // async:true will be default in foundry 0.10
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

  private isNaturalCritSuccess(): boolean {
    return this.naturalTotal == 12;
  }

  private isNaturalCritFail(): boolean {
    return this.naturalTotal == 2;
  }

  public isSuccess(): boolean {
    return this.effect >= 0;
  }

  private calculateEffect(): void {
    let effect;
    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      effect = this.roll.total - this.settings.difficulty.target;
    } else {
      effect = this.roll.total - TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))].Average.target;
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

  private static addSign(value: number): string {
    return `${value <= 0 ? "" : "+"}${value}`;
  }

  public async sendToChat(): Promise<void> {
    const rollingString = game.i18n.localize("TWODSIX.Rolls.Rolling");
    const usingString = game.i18n.localize("TWODSIX.Actor.using");
    const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    const difficulty = game.i18n.localize(getKeyByValue(difficulties, this.settings.difficulty));

    let flavor = `${rollingString}: ${difficulty}`;

    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      flavor += `(${this.settings.difficulty.target}+)`;
    } else {
      // @ts-ignore
      const difficultyMod = TwodsixDiceRoll.addSign(this.roll.data.difficultyMod);
      flavor += `(${difficultyMod})`;
    }

    if (this.settings.rollType != TWODSIX.ROLLTYPES.Normal.key) {
      const rollType = advantageDisadvantageTerm(this.settings.rollType);
      flavor += ` ${game.i18n.localize("TWODSIX.Rolls.With")} ${rollType}`;
    }

    if (this.skill) {
      // @ts-ignore
      const skillValue = TwodsixDiceRoll.addSign(this.roll.data.skill);
      flavor += ` ${this.skill.data.name}(${skillValue})`;
    }

    if (this.item) {
      flavor += ` ${usingString} ${this.item.data.name}`;
    }

    // @ts-ignore
    if (this.roll.data.DM) {
      // @ts-ignore
      flavor += ` +DM(${TwodsixDiceRoll.addSign(this.roll.data.DM)})`;
    }

    if (this.settings.characteristic !== 'NONE') { //TODO Maybe this should become a 'characteristic'? Would mean characteristic could be typed rather than a string...
      const characteristicValue = TwodsixDiceRoll.addSign(this.roll.data[this.settings.characteristic]);
      let charShortName:string = getCharShortName(this.settings.characteristic);
      flavor += ` ${usingString} ${charShortName}(${characteristicValue})`;
    }

    await this.roll.toMessage(
      {
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        flavor: flavor,
        rollMode: this.settings.rollMode,
        flags: {
          "core.canPopout": true,
          "twodsix.crit": this.getCrit(),
          "twodsix.effect": this.effect
        }
      },
      // @ts-ignore
      {rollMode: this.settings.rollMode}
    );
  }
}
