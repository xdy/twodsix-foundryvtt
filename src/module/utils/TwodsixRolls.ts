import {TWODSIX} from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import {advantageDisadvantageTerm} from "../i18n";
import {calcModFor, getKeyByValue} from "./sheetUtils";

//TODO This one needs refactoring.
export class TwodsixRolls {

  private static targetNumber() {
    const variant = game.settings.get('twodsix', 'difficultyListUsed');
    const difficultyList = TWODSIX.DIFFICULTIES[variant];
    return difficultyList.Average.target;
  }

  private static async rollDialog(parts, data, flavorParts, title, speaker, showEffect, actor, item, characteristic):Promise<Roll> {
    let rolled = false;
    const usefulParts = parts.filter(function (el) {
      return el != '' && el;
    });

    const template = 'systems/twodsix/templates/chat/roll-dialog.html';
    const dialogData = {
      data: data,
      rollType: "Normal",
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: "Average",
      difficulties: TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')],
      rollMode: game.settings.get('core', 'rollMode'),
      rollModes: CONFIG.Dice.rollModes,
      skillModifier: item ? item?.data?.data?.skillModifier : 0,
      characteristic: characteristic
    };

    let roll:Roll;
    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fas fa-dice"></i>',
        callback: (html) => {
          roll = TwodsixRolls._handleRoll(html[0].children[0], usefulParts, data, flavorParts, speaker, showEffect, actor);
          this.rollDamage(item, showEffect, actor, false, roll._total, this.targetNumber());
          rolled = true;
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel"),
      },
    };

    const html = await renderTemplate(template, dialogData);
    new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: 'ok',
        close: () => {
          resolve(rolled ? roll : false);
        },
      }).render(true);
    });

    return roll;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  private static _handleRoll(form, rollParts, data, flavorParts, speaker, showEffect, actor):Roll {
    let rollMode = game.settings.get('core', 'rollMode');

    const usingItem = flavorParts.length == 2;

    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    if (form !== null) {
      data.skillModifier = form.skillModifier.value;
      data.difficulty = difficulties[form.difficulty.value];
      data.rollType = form.rollType.value;
      data.rollMode = form.rollMode.value;
      data.characteristic = form.characteristic.value;
    }

    const skillModifier = data.skillModifier;
    if (skillModifier && skillModifier.length > 0 && skillModifier !== "0") {
      rollParts.push(skillModifier);
      flavorParts.push(skillModifier >= 0 ? "+" + skillModifier : skillModifier);
    }

    //Should use Average if no difficulty is chosen, else the variant's Average (i.e. 6 or 8)
    //Should add modifier if not using targetnumber, else 0.
    let targetNumber = this.targetNumber();
    if (data.difficulty) {
      const datum = data.difficulty;
      const keyByValue = getKeyByValue(difficulties, datum);
      if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
        targetNumber = data.difficulty.target;
      } else {
        if (datum.mod !== 0) {
          rollParts.push("" + datum.mod);
        }
      }
      flavorParts.unshift(`${(game.i18n.localize(keyByValue))}`);
    }

    flavorParts.unshift(game.i18n.localize("TWODSIX.Rolls.Rolling") + ":");
    if (usingItem) {
      const pop = flavorParts.pop();
      const pop2 = flavorParts.pop();
      flavorParts.push(game.i18n.localize("TWODSIX.Actor.using"));
      flavorParts.push(pop2);
      flavorParts.push(pop);
    }

    if (data.rollType && data.rollType.length > 0) {
      if (rollParts[0] == '2d6') {
        rollParts[0] = TWODSIX.ROLLTYPES[data.rollType];
      } else {
        rollParts.unshift(TWODSIX.ROLLTYPES[data.rollType]);
      }
      if (data.rollType != 'Normal') {
        flavorParts.push(game.i18n.localize("TWODSIX.Rolls.With"));
        flavorParts.push(`${(advantageDisadvantageTerm(data.rollType))}`);
      }
    }

    if (data.characteristic && data.characteristic.length > 0 && data.characteristic !== 'NONE') {
      rollParts[1] = actor.data.data.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, data.characteristic)].mod;
      flavorParts.push(game.i18n.format("TWODSIX.Rolls.using", {characteristic: game.i18n.localize("TWODSIX.Items.Skills." + data.characteristic)}));
    }

    TwodsixRolls.skillRollResultDisplay(rollParts, flavorParts, showEffect, targetNumber);
    const roll = new Roll(rollParts.join('+'), data).roll();
    const flavor = flavorParts.join(' ');

    rollMode = form ? form.rollMode.value : rollMode;
    roll.toMessage(
      {
        speaker: speaker,
        flavor: flavor
      },
      {rollMode: rollMode}
    );
    return roll;
  }

  public static async performRoll(actor:TwodsixActor, itemId:string, dataset:DOMStringMap, advanced:boolean):Promise<void> {
    const showEffect = game.settings.get("twodsix", "effectOrTotal");
    let skillId:string;
    let item = actor.getOwnedItem(itemId) as TwodsixItem;
    let skill:TwodsixItem;
    let characteristic;

    if ('skills' === item?.data?.data?.type) {
      //It *is* the skill, so don't need item.
      skill = item;
      dataset.skill = skill.name;
      item = null;
      dataset.item = "";
      this.createDatasetRoll(dataset, skill, actor);
      characteristic = skill.data.data.characteristic;
    } else if (item) {
      //If the item isn't the skill, dig up the skill from the item
      skillId = item.data.data.skill;
      skill = actor.getOwnedItem(skillId) as TwodsixItem;
      if (skill != null) {
        dataset.skill = skill.name;
        dataset.item = item.name;
        this.createDatasetRoll(dataset, skill, actor);
      } else {
        //No skill, no roll
        return;
      }
      characteristic = skill.data.data.characteristic;
    } else if (dataset.label === 'Untrained') {
      //Untrained pseudo-skill
      dataset.skill = game.i18n.localize("TWODSIX.Actor.Skills.Untrained");
      dataset.roll = "2d6" + "+" + this.recalcMod('NONE', actor) + "+" + game.settings.get('twodsix', 'untrainedSkillValue');
      characteristic = 'NONE';
    } else {
      //It's a characteristic roll, everything is set already, but, don't add characteristic bonus again by default.
      characteristic = 'NONE';
    }
    if (advanced) {
      await TwodsixRolls.advancedSkillRoll(dataset, actor, item, showEffect, characteristic);
    } else {
      await TwodsixRolls.simpleSkillRoll(dataset, actor, item, showEffect);
    }
  }

  private static createDatasetRoll(dataset, skill:TwodsixItem, actor:TwodsixActor) {
    if (!dataset.roll) {
      if (skill) {
        const mod = this.recalcMod(skill.data.data.characteristic, actor);
        dataset.roll = "2d6" + "+" + mod + "+" + skill.data.data.value;
      }
    }
    console.log(dataset.roll);
  }

  private static recalcMod(characteristic:string, actor:TwodsixActor) {
    if ('NONE' === characteristic) {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return calcModFor(actor.data.data.characteristics[keyByValue].current);
    }
  }

  private static async simpleSkillRoll(dataset:DOMStringMap, actor:TwodsixActor, item ?:TwodsixItem, showEffect:boolean = game.settings.get("twodsix", "effectOrTotal")):Promise<void> {
    const rollParts = dataset.roll?.split("+") || [];
    const flavorParts:string[] = [];
    let label:string;
    if (dataset.roll) {
      label = dataset.label != null ? game.i18n.localize("TWODSIX.Actor.Rolling") + ` ${dataset.label}` : '';
    }
    if (dataset.skill) {
      label = game.i18n.localize("TWODSIX.Actor.Rolling") + ` ${dataset.skill}`;
      if (dataset.item) {
        label += ' ' + game.i18n.localize("TWODSIX.Actor.using") + ` ${dataset.item}`;
        let skillModifier = (item ? item?.data?.data?.skillModifier : 0);
        if (skillModifier !== 0) {
          if (skillModifier >= 0) {
            skillModifier = " +" + skillModifier;
          }
          rollParts.push(skillModifier);
          label += skillModifier;
        }
      }
    }
    flavorParts.push(label);


    TwodsixRolls.skillRollResultDisplay(rollParts, flavorParts, showEffect, this.targetNumber());
    const flavor = flavorParts.join(' ');
    const skillRoll = new Roll(rollParts.join('+'), actor.data.data);

    const result = skillRoll.roll();
    await result.toMessage({
      speaker: ChatMessage.getSpeaker({actor: actor}),
      flavor: flavor
    });
    await this.rollDamage(item, showEffect, actor, false, result._total, this.targetNumber());
  }

  static async rollDamage(item:TwodsixItem, showEffect:boolean, actor:TwodsixActor, justRollIt = true, total = 0, targetNumber = 0):Promise<void> {
    const result = showEffect ? total : total - targetNumber;
    const rollDamage = game.settings.get("twodsix", "automateDamageRollOnHit") || justRollIt;
    if (result >= 0 && rollDamage && item?.data?.data?.damage != null) {
      const damageFormula = item.data.data.damage + (justRollIt ? "" : "+" + result);
      const damageRoll = new Roll(damageFormula, actor.data.data);
      const damage = damageRoll.roll();
      await damage.toMessage({
        speaker: ChatMessage.getSpeaker({actor: actor}),
        flavor: justRollIt ? game.i18n.localize("TWODSIX.Rolls.DamageUsing") + " " + item.name : game.i18n.localize("TWODSIX.Rolls.AdjustedDamage")
      });
    }
  }

  private static async advancedSkillRoll(dataset:DOMStringMap, actor:TwodsixActor, item:TwodsixItem, showEffect:boolean, characteristic) {
    const skillData = {};

    const rollParts = dataset.roll?.split("+");

    const flavorParts:string[] = [];
    let title;
    if (dataset.roll && !dataset.skill) {
      flavorParts.push(`${dataset.label}`);
      title = dataset.label;
    }
    if (dataset.skill) {
      flavorParts.push(`${dataset.skill}`);
      title = dataset.skill;
      if (dataset.item) {
        flavorParts.push(`${dataset.item}`);
      }
    }

    await TwodsixRolls.rollDialog(rollParts, skillData, flavorParts, title, ChatMessage.getSpeaker({actor: actor}), showEffect, actor, item, characteristic);

  }

  private static skillRollResultDisplay(rollParts:string[], flavorParts:string[], showEffect:boolean, targetNumber:number):void {
    if (showEffect) {
      //So that the result is the Effect of the skill roll.
      rollParts.push("-" + String(targetNumber));
    }
    const string = showEffect ? game.i18n.localize("TWODSIX.Rolls.Effect") : game.i18n.localize("TWODSIX.Rolls.sum");
    flavorParts.push("(" + game.i18n.localize("TWODSIX.Rolls.resultShows") + " " + string + ")");
  }
}
