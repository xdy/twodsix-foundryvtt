import {TWODSIX} from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import {advantageDisadvantageTerm} from "../i18n";
import {calcModFor, getKeyByValue} from "./sheetUtils";

//TODO This one needs refactoring.
export class TwodsixRolls {

  private static async rollDialog(parts, flavorParts, title, showEffect, actor, item, characteristic, skill):Promise<Roll> {
    let rolled = false;
    const speaker = ChatMessage.getSpeaker({actor: actor});
    const usefulParts = parts.filter(function (el) {
      return el != '' && el;
    });
    const template = 'systems/twodsix/templates/chat/roll-dialog.html';
    const twodsix = game.settings.get('twodsix', 'difficultyListUsed');
    const difficulties = TWODSIX.DIFFICULTIES[twodsix];
    const difficulty = skill ? difficulties[skill.data.data.difficulty] : difficulties.Average;
    const dialogData = {
      rollType: "Normal",
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: getKeyByValue(difficulties, difficulty),
      difficulties: difficulties,
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
          roll = TwodsixRolls._handleRoll(html, usefulParts, flavorParts, speaker, showEffect, actor);
          this.rollDamage(item, showEffect, actor, false, roll._total, difficulty.target);
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
  private static _handleRoll(html, rollParts, flavorParts, speaker, showEffect, actor):Roll {
    const usingItem = flavorParts.length == 2;
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    const difficulty = difficulties[html.find('[name="difficulty"]').val()];
    const rollType = html.find('[name="rollType"]').val();
    const rollMode = html.find('[name="rollMode"]').val();
    const characteristic = html.find('[name="characteristic"]').val();
    const skillModifier = html.find('[name="skillModifier"]').val();

    if (skillModifier && skillModifier.length > 0 && skillModifier !== "0") {
      rollParts.push(skillModifier);
      flavorParts.push(skillModifier >= 0 ? "+" + skillModifier : skillModifier);
    }

    let difficultyString = game.i18n.localize(getKeyByValue(difficulties, difficulty));
    if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
      difficultyString += ` (${difficulty.target}+)`;
    }

    if (!game.settings.get('twodsix', 'difficultiesAsTargetNumber') && !showEffect) {
      if (difficulty.mod !== 0) {
        rollParts.push("" + difficulty.mod);
      }
    }

    flavorParts.unshift(difficultyString);

    flavorParts.unshift(game.i18n.localize("TWODSIX.Rolls.Rolling") + ":");
    if (usingItem) {
      const pop = flavorParts.pop();
      const pop2 = flavorParts.pop();
      flavorParts.push(game.i18n.localize("TWODSIX.Actor.using"));
      flavorParts.push(pop2);
      flavorParts.push(pop);
    }

    if (rollType && rollType.length > 0) {
      if (rollParts[0] == '2d6') {
        rollParts[0] = TWODSIX.ROLLTYPES[rollType];
      } else {
        rollParts.unshift(TWODSIX.ROLLTYPES[rollType]);
      }
      if (rollType != 'Normal') {
        flavorParts.push(game.i18n.localize("TWODSIX.Rolls.With"));
        flavorParts.push(`${(advantageDisadvantageTerm(rollType))}`);
      }
    }

    if (characteristic && characteristic.length > 0 && characteristic !== 'NONE') {
      rollParts[1] = actor.data.data.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)].mod;
      flavorParts.push(game.i18n.format("TWODSIX.Rolls.using", {characteristic: game.i18n.localize("TWODSIX.Items.Skills." + characteristic)}));
    }

    TwodsixRolls.skillRollResultDisplay(rollParts, flavorParts, showEffect, difficulty.target);

    const data = {
      rollMode: rollMode,
      rollType: rollType
    };
    const roll = new Roll(rollParts.join('+'), data).roll();
    const flavor = flavorParts.join(' ');

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
      await TwodsixRolls.advancedSkillRoll(dataset, actor, item, showEffect, characteristic, skill);
    } else {
      await TwodsixRolls.simpleSkillRoll(dataset, actor, skill, item, showEffect);
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

  //TODO Get rid of simpleSkillRoll, instead call advancedSkillRoll with a 'show dialog' boolean
  private static async simpleSkillRoll(dataset:DOMStringMap, actor:TwodsixActor, skill, item?:TwodsixItem, showEffect:boolean = game.settings.get("twodsix", "effectOrTotal")):Promise<void> {
    const rollParts = dataset.roll?.split("+") || [];
    const flavorParts:string[] = [];
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    const difficulty = skill ? difficulties[skill.data.data.difficulty] : difficulties.Average;
    let label:string;
    if (dataset.roll) {
      label = dataset.label != null ? game.i18n.localize("TWODSIX.Actor.Rolling") + `: ${dataset.label}` : '';
    }
    if (dataset.skill) {
      let difficultyString = game.i18n.localize(getKeyByValue(difficulties, difficulty));
      if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
        difficultyString += ` (${difficulty.target}+)`;
      }
      label = game.i18n.localize("TWODSIX.Actor.Rolling") + ": " + difficultyString + ` ${dataset.skill}`;
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

    if (!game.settings.get('twodsix', 'difficultiesAsTargetNumber') && !showEffect) {
      if (difficulty.mod !== 0) {
        rollParts.push("" + difficulty.mod);
      }
    }

    flavorParts.push(label);

    TwodsixRolls.skillRollResultDisplay(rollParts, flavorParts, showEffect, difficulty.target);
    const flavor = flavorParts.join(' ');
    const skillRoll = new Roll(rollParts.join('+'), {});

    const result = skillRoll.roll();
    await result.toMessage({
      speaker: ChatMessage.getSpeaker({actor: actor}),
      flavor: flavor
    });
    await this.rollDamage(item, showEffect, actor, false, result._total, difficulty.target);
  }

  static async rollDamage(item:TwodsixItem, showEffect:boolean, actor:TwodsixActor, justRollIt = true, total = 0, targetNumber = 0):Promise<void> {
    const result = showEffect ? total : total - targetNumber;
    const rollDamage = game.settings.get("twodsix", "automateDamageRollOnHit") || justRollIt;
    const success = result >= 0;
    const doesDamage = item?.data?.data?.damage != null;
    if (success && rollDamage && doesDamage) {
      const damageFormula = item.data.data.damage + (justRollIt ? "" : "+" + result);
      const damageRoll = new Roll(damageFormula, actor.data.data);
      const damage = damageRoll.roll();
      await damage.toMessage({
        speaker: ChatMessage.getSpeaker({actor: actor}),
        flavor: justRollIt ? game.i18n.localize("TWODSIX.Rolls.DamageUsing") + " " + item.name : game.i18n.localize("TWODSIX.Rolls.AdjustedDamage")
      });
    }
  }

  private static async advancedSkillRoll(dataset:DOMStringMap, actor:TwodsixActor, item:TwodsixItem, showEffect:boolean, characteristic, skill:TwodsixItem) {
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

    await TwodsixRolls.rollDialog(rollParts, flavorParts, title, showEffect, actor, item, characteristic, skill);

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
