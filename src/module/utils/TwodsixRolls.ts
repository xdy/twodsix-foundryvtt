import {TWODSIX} from "../config";
import type TwodsixItem from "../entities/TwodsixItem";
import type TwodsixActor from "../entities/TwodsixActor";
import {advantageDisadvantageTerm} from "../i18n";
import {calcModFor, getKeyByValue} from "./sheetUtils";

type throwSettings = { difficulty; skillModifier; shouldRoll:boolean; rollType:string; rollMode:string; characteristic }

//TODO This one needs refactoring.
//At least within this class a Roll is just a roll of some dice, whereas a Throw belongs to the Cepheus Engine domain and denotes a 'throw' of a skill or characteristic, which I really wish had a better common name...
//Throw isn't yet a class, but, I may be heading in that direction.
export class TwodsixRolls {

  private static async _throwDialog(title, difficulties, settings:throwSettings):Promise<throwSettings> {
    let updatedSettings = settings;
    const template = 'systems/twodsix/templates/chat/throw-dialog.html';
    const dialogData = {
      rollType: "Normal",
      rollTypes: TWODSIX.ROLLTYPES,
      difficulty: getKeyByValue(difficulties, settings.difficulty),
      difficulties: difficulties,
      rollMode: game.settings.get('core', 'rollMode'),
      rollModes: CONFIG.Dice.rollModes,
      skillModifier: settings.skillModifier,
      characteristic: settings.characteristic
    };

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fas fa-dice"></i>',
        callback: (buttonHtml) => {
          return updatedSettings = {
            shouldRoll: true,
            difficulty: difficulties[buttonHtml.find('[name="difficulty"]').val()],
            rollType: buttonHtml.find('[name="rollType"]').val(),
            rollMode: buttonHtml.find('[name="rollMode"]').val(),
            characteristic: buttonHtml.find('[name="characteristic"]').val(),
            skillModifier: buttonHtml.find('[name="skillModifier"]').val()
          };
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel"),
        callback: () => {
          updatedSettings.shouldRoll = false;
          return updatedSettings;
        }
      },
    };

    const html = await renderTemplate(template, dialogData);
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: 'ok',
        close: () => {
          resolve(updatedSettings);
        },
      }).render(true);
    });
  }

  public static async performThrow(actor:TwodsixActor, itemId:string, dataset:DOMStringMap, showThrowDialog:boolean, numAttacks = 1):Promise<void> {
    const showEffect = game.settings.get("twodsix", "effectOrTotal");
    let skillId:string;
    let item:TwodsixItem | null = actor.getOwnedItem(itemId) as TwodsixItem;
    let skill:TwodsixItem | null = null;
    let characteristic;

    if ('skills' === item?.data?.data?.type) {
      //It *is* the skill, so don't need item.
      skill = item;
      dataset.skill = skill.name;
      item = null;
      dataset.item = "";
      this._createDatasetRoll(dataset, skill, actor);
      characteristic = skill.data.data.characteristic;
    } else if (item) {
      //If the item isn't the skill, dig up the skill from the item
      skillId = item.data.data.skill;
      skill = actor.getOwnedItem(skillId) as TwodsixItem;
      if (skill != null) {
        dataset.skill = skill.name;
        dataset.item = item.name;
        this._createDatasetRoll(dataset, skill, actor);
      } else {
        //No skill, no roll
        return;
      }
      characteristic = skill.data.data.characteristic;
    } else if (dataset.label === 'Untrained') {
      //Untrained pseudo-skill
      dataset.skill = game.i18n.localize("TWODSIX.Actor.Skills.Untrained");
      dataset.roll = "2d6" + "+" + this._recalculateMod('NONE', actor) + "+" + game.settings.get('twodsix', 'untrainedSkillValue');
      characteristic = 'NONE';
    } else {
      //It's a characteristic roll, everything is set already, but, don't add characteristic bonus again by default.
      characteristic = 'NONE';
    }
    await TwodsixRolls._handleThrows(dataset, actor, item, showEffect, characteristic, skill, showThrowDialog, numAttacks);
  }

  private static _createDatasetRoll(dataset:DOMStringMap, skill:TwodsixItem, actor:TwodsixActor) {
    if (!dataset.roll) {
      if (skill) {
        const mod = this._recalculateMod(skill.data.data.characteristic, actor);
        dataset.roll = "2d6" + "+" + mod + "+" + skill.data.data.value;
      }
      if (dataset.rofBonus) {
        dataset.roll += `+${dataset["rofBonus"]}`;
      }
    }
  }

  private static _recalculateMod(characteristic:string, actor:TwodsixActor) {
    if ('NONE' === characteristic) {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return calcModFor(actor.data.data.characteristics[keyByValue].current);
    }
  }

  static async rollDamage(item:TwodsixItem | null, showEffect:boolean, actor:TwodsixActor, rollMode:string, bonusDamage:number):Promise<void> {
    const doesDamage = item?.data?.data?.damage != null;
    let damage:Roll;
    if (doesDamage) {
      const damageFormula = item?.data?.data?.damage + (bonusDamage > 0 ? "+" + bonusDamage : "");
      const damageRoll = new Roll(damageFormula, {});
      damage = damageRoll.roll();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const results = damage.terms[0].results;
      const contentData = {
        flavor: `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${item?.name}`,
        roll: damage,
        damage: damage.total,
        dice: results
      };

      const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);

      const messageData = {
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({actor: actor}),
        content: html,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: damage,
        rollMode: rollMode,
        flags: {"core.canPopout": true}
      };

      messageData["flags.transfer"] = JSON.stringify(
        {
          type: 'damageItem',
          payload: contentData
        }
      );

      CONFIG.ChatMessage.entityClass.create(messageData, {rollMode: rollMode}).then((arg) => {
        console.log(arg);
      });
    }
  }

  private static async _handleThrows(dataset:DOMStringMap, actor:TwodsixActor, item:TwodsixItem | null, showEffect:boolean, characteristic, skill:TwodsixItem | null, showRollDialog:boolean, numAttacks:number) {
    let rollParts:string[] = [];
    const speaker = ChatMessage.getSpeaker({actor: actor});
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    const rollMode = game.settings.get('core', 'rollMode');
    const difficulty = skill ? difficulties[skill.data.data.difficulty] : difficulties.Average;
    const skillModifier = item?.data?.data?.skillModifier ?? 0;

    let settings:throwSettings = {
      shouldRoll: false,
      rollType: "Normal",
      rollMode: rollMode,
      difficulty: difficulty,
      skillModifier: skillModifier,
      characteristic: characteristic
    };

    if (dataset.roll) {
      rollParts = dataset.roll.split("+");
    }
    const flavorParts:string[] = [];

    let title;
    if (dataset.roll && !dataset.skill) {
      flavorParts.push(`${dataset.label}`);
      title = dataset.label;
    }
    if (dataset.skill) {
      flavorParts.push(`${dataset.skill}`);
      if (dataset.item) {
        title = `${dataset.skill} ${game.i18n.localize("TWODSIX.Actor.using")} ${dataset.item}`;
        flavorParts.push(`${dataset.item}`);
      } else {
        title = dataset.skill;
      }
    }

    if (showRollDialog) {
      settings = await TwodsixRolls._throwDialog(title, difficulties, settings);
    } else {
      settings.shouldRoll = true;
    }

    if (settings.shouldRoll) {
      const usingItem = flavorParts.length == 2;

      if (!game.settings.get('twodsix', 'difficultiesAsTargetNumber') && !showEffect) {
        if (settings.difficulty.mod !== 0) {
          rollParts.push("" + settings.difficulty.mod);
        }
      }

      let difficultyString = game.i18n.localize(<string>getKeyByValue(difficulties, settings.difficulty));
      if (game.settings.get('twodsix', 'difficultiesAsTargetNumber')) {
        difficultyString += ` (${settings.difficulty.target}+)`;
      }

      flavorParts.unshift(difficultyString);

      flavorParts.unshift(game.i18n.localize("TWODSIX.Rolls.Rolling") + ":");
      if (usingItem) {
        const pop = flavorParts.pop();
        flavorParts.push(game.i18n.localize("TWODSIX.Actor.using"));
        flavorParts.push(pop);
      }

      //Handle skillModifier
      if (settings.skillModifier !== 0) {
        rollParts.push(settings.skillModifier);
        flavorParts.push(settings.skillModifier >= 0 ? "+" + settings.skillModifier : settings.skillModifier);
      }

      if (settings.rollType && settings.rollType.length > 0) {
        if (rollParts[0] == '2d6') {
          rollParts[0] = TWODSIX.ROLLTYPES[settings.rollType];
        } else {
          rollParts.unshift(TWODSIX.ROLLTYPES[settings.rollType]);
        }

        if (settings.rollType != 'Normal') {
          flavorParts.push(game.i18n.localize("TWODSIX.Rolls.With"));
          flavorParts.push(`${(advantageDisadvantageTerm(settings.rollType))}`);
        }
      }

      if (settings.characteristic && settings.characteristic.length > 0 && settings.characteristic !== 'NONE') {
        rollParts[1] = actor.data.data.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, settings.characteristic)].mod;
        flavorParts.push(game.i18n.format("TWODSIX.Rolls.using", {characteristic: game.i18n.localize("TWODSIX.Items.Skills." + settings.characteristic)}));
      }

      if (showEffect) {
        //So that the result is the Effect of the skill roll.
        rollParts.push("-" + settings.difficulty.target);
      }
      flavorParts.push(`(${game.i18n.localize("TWODSIX.Rolls.resultShows")} ${showEffect ? game.i18n.localize("TWODSIX.Rolls.Effect") : game.i18n.localize("TWODSIX.Rolls.sum")})`);

      const flavor = flavorParts.join(' ');
      const data = {
        rollMode: settings.rollMode,
        rollType: settings.rollType,
        flavor: flavor
      };

      for (let i = 0; i < numAttacks; i++) {

        const roll = new Roll(rollParts.filter(function (el) {
          return el != '' && el;
        }).join('+'), data);

        //Do the throw
        roll.roll();

        let effect:number, crit:number;
        if (showEffect) {
          effect = roll.total;
        } else {
          effect = roll.total - difficulty.target;
        }

        //Handle special results
        const diceResult = roll.dice[0].results.reduce((total:number, dice) => {
          return dice["active"] ? total + dice["result"] : total;
        }, 0);

        if (diceResult === 2) {
          crit = TWODSIX.CRIT.FAIL;
          console.log(`Got a natural 2 with Effect ${effect}!`);
          if (effect >= 0 && game.settings.get('twodsix', 'criticalNaturalAffectsEffect')) {
            console.log("Setting Effect to -1 due to natural 2!");
            effect = -1;
          }
        } else if (diceResult === 12) {
          crit = TWODSIX.CRIT.SUCCESS;
          console.log(`Got a natural 12 with Effect ${effect}!`);
          if (effect < 0 && game.settings.get('twodsix', 'criticalNaturalAffectsEffect')) {
            console.log("Setting Effect to 0 due to natural 12!");
            effect = 0;
          }
        }

        const CRITICAL_EFFECT_VALUE = game.settings.get('twodsix', 'absoluteCriticalEffectValue');
        if (effect >= CRITICAL_EFFECT_VALUE) {
          if (!crit) {
            crit = TWODSIX.CRIT.SUCCESS;
            console.log("Got a critical success due to high Effect");
          }
        } else if (effect <= -CRITICAL_EFFECT_VALUE) {
          if (!crit) {
            crit = TWODSIX.CRIT.FAIL;
            console.log("Got a critical failure due to low Effect");
          }
        }

        //And send to chat
        await roll.toMessage(
          {
            speaker: speaker,
            flavor: flavor,
            rollType: settings.rollType,
            flags: {"core.canPopout": true, "twodsix.crit": crit}
          },
          {rollMode: rollMode}
        );

        //With possible followup
        if (game.settings.get("twodsix", "automateDamageRollOnHit") && effect >= 0) {
          await this.rollDamage(item, showEffect, actor, rollMode, effect);
        }
      }
    }
  }
}
