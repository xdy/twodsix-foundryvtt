import {TWODSIX} from "../config";
import {advantageDisadvantageTerm} from "../settings";
import TwodsixItem from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";


export class TwodsixRolls {
  private static DEFAULT_TARGET_NUMBER_MODIFIER = "-8";

  private static async rollDialog(parts, data, flavorParts, title, speaker, showEffect, actor, item):Promise<Roll> {
    let rolled = false;
    const usefulParts = parts.filter(function (el) {
      return el != '' && el;
    });

    const template = 'systems/twodsix/templates/chat/roll-dialog.html';
    const dialogData = {
      formula: usefulParts.join(' '),
      data: data,
      rollType: "Normal",
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: "Average",
      difficulties: TWODSIX.DIFFICULTIES,
      rollMode: game.settings.get('core', 'rollMode'),
      rollModes: CONFIG.Dice.rollModes,
      skillModifier: item ? item?.data?.data?.skillModifier : 0
    };

    let roll:Roll;
    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fas fa-dice"></i>',
        callback: (html) => {
          roll = TwodsixRolls._handleRoll(html[0].children[0], usefulParts, data, flavorParts, speaker, showEffect);
          this.rollDamage(item, showEffect, roll._total, actor);
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
  private static _handleRoll(form, rollParts, data, flavorParts, speaker, showEffect):Roll {
    let rollMode = game.settings.get('core', 'rollMode');

    const usingItem = flavorParts.length == 2;

    if (form !== null) {
      data['skillModifier'] = form.skillModifier.value;
      data['difficulty'] = form.difficulty.value;
      data['rollType'] = form.rollType.value;
      data['rollMode'] = form.rollMode.value;
    }

    const skillModifier = data['skillModifier'];
    if (skillModifier && skillModifier.length > 0) {
      rollParts.push(skillModifier);
      flavorParts.push(skillModifier >= 0 ? "+" + skillModifier : skillModifier);
    }

    if (data['difficulty'] && data['difficulty'].length > 0) {
      rollParts.push("" + TWODSIX.DIFFICULTIES[data['difficulty']]);
      flavorParts.unshift(`${data['difficulty']}`);
    }

    flavorParts.unshift(game.i18n.localize("TWODSIX.Rolls.Rolling") + ":");
    if (usingItem) {
      const pop = flavorParts.pop();
      const pop2 = flavorParts.pop();
      flavorParts.push(game.i18n.localize("TWODSIX.Actor.using"));
      flavorParts.push(pop2);
      flavorParts.push(pop);
    }

    if (data['rollType'] && data['rollType'].length > 0) {
      if (rollParts[0] == '2d6') {
        rollParts[0] = TWODSIX.ROLLTYPES[data['rollType']];
      } else {
        rollParts.unshift(TWODSIX.ROLLTYPES[data['rollType']]);
      }
      if (data['rollType'] != 'Normal') {
        flavorParts.push(game.i18n.localize("TWODSIX.Rolls.With"));
        flavorParts.push(`${(advantageDisadvantageTerm(data['rollType']))}`);
      }
    }

    TwodsixRolls.skillRollResultDisplay(rollParts, flavorParts, showEffect);
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

  static async handleSkillRoll(event:Event, actor:TwodsixActor) {
    const element = event.currentTarget;
    const dataset = element["dataset"];
    const showEffect = game.settings.get("twodsix", "effectOrTotal");

    let skillId:string;
    let item:TwodsixItem;
    //Get the item
    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    item = actor.getOwnedItem(itemId) as TwodsixItem;
    let skill:TwodsixItem;

    if ('skills' === item?.data?.type) {
      //It *is* the skill, so don't need item.
      skill = item;
      dataset.skill = skill.name;
      item = null;
      dataset.item = "";
    } else if (item) {
      //If the item isn't the skill, dig up the skill from the item
      skillId = item.data.data.skill;
      skill = actor.getOwnedItem(skillId) as TwodsixItem;
      if (skill != null) {
        dataset.skill = skill.name;
        dataset.item = item.name;
        dataset.roll = "2d6+" + skill.data.data.mod + "+" + skill.data.data.value;
      } else {
        //No skill, no roll
        return;
      }
    } else {
      //It's a characteristic roll, everything is set already.
    }
    if (event["shiftKey"]) {
      await TwodsixRolls.advancedSkillRoll(event, dataset, actor, item, showEffect);
    } else {
      TwodsixRolls.simpleSkillRoll(dataset, actor, item, showEffect);
    }
  }

  private static simpleSkillRoll(dataset:DOMStringMap, actor:TwodsixActor, item ?:TwodsixItem, showEffect:boolean = game.settings.get("twodsix", "effectOrTotal")):void {
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
        if (skillModifier >= 0) {
          skillModifier = " +" + skillModifier;
        }
        rollParts.push(skillModifier);
        label += skillModifier;
      }
    }
    flavorParts.push(label);
    TwodsixRolls.skillRollResultDisplay(rollParts, flavorParts, showEffect);
    const flavor = flavorParts.join(' ');
    const skillRoll = new Roll(rollParts.join('+'), actor.data.data);

    console.log(dataset.roll);
    const result = skillRoll.roll();
    result.toMessage({
      speaker: ChatMessage.getSpeaker({actor: actor}),
      flavor: flavor
    });
    this.rollDamage(item, showEffect, result._total, actor);

  }

  private static async rollDamage(item:TwodsixItem, showEffect:boolean, total:number, actor:TwodsixActor) {
    if (total > 0 && game.settings.get("twodsix", "automateDamageRollOnHit") && item?.data?.data?.damage != null) {
      const damageFormula = item.data.data.damage + "+" + (showEffect ? total : total - 8);
      const damageRoll = new Roll(damageFormula, actor.data.data);
      const damage = damageRoll.roll();
      await damage.toMessage({
        speaker: ChatMessage.getSpeaker({actor: actor}),
        flavor: game.i18n.localize("TWODSIX.Rolls.AdjustedDamage")
      });
    }
  }

  private static async advancedSkillRoll(event:{ preventDefault:() => void; currentTarget:any }, dataset:DOMStringMap, actor:TwodsixActor, item:TwodsixItem, showEffect:boolean) {
    const skillData = {};
    const rollParts = dataset.roll?.split("+") || [];

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

    await TwodsixRolls.rollDialog(rollParts, skillData, flavorParts, title, ChatMessage.getSpeaker({actor: actor}), showEffect, actor, item);

  }

  private static skillRollResultDisplay(rollParts:string[], flavorParts:string[], showEffect:boolean):void {
    if (showEffect) {
      //So that the result is the Effect of the skill roll.
      rollParts.push(TwodsixRolls.DEFAULT_TARGET_NUMBER_MODIFIER);
    }
    const string = showEffect ? game.i18n.localize("TWODSIX.Rolls.Effect") : game.i18n.localize("TWODSIX.Rolls.sum");
    flavorParts.push("(" + game.i18n.localize("TWODSIX.Rolls.resultShows") + " " + string + ")");
  }
}
