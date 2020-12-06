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
        callback: (html) => {
          return updatedSettings = {
            shouldRoll: true,
            difficulty: difficulties[html.find('[name="difficulty"]').val()],
            rollType: html.find('[name="rollType"]').val(),
            rollMode: html.find('[name="rollMode"]').val(),
            characteristic: html.find('[name="characteristic"]').val(),
            skillModifier: html.find('[name="skillModifier"]').val()
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

  public static async performThrow(actor:TwodsixActor, itemId:string, dataset:DOMStringMap, showThrowDialog:boolean):Promise<void> {
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
    await TwodsixRolls._handleThrows(dataset, actor, item, showEffect, characteristic, skill, showThrowDialog);
  }

  private static _createDatasetRoll(dataset:DOMStringMap, skill:TwodsixItem, actor:TwodsixActor) {
    if (!dataset.roll) {
      if (skill) {
        const mod = this._recalculateMod(skill.data.data.characteristic, actor);
        dataset.roll = "2d6" + "+" + mod + "+" + skill.data.data.value;
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

  static async rollDamage(item:TwodsixItem | null, showEffect:boolean, actor:TwodsixActor, justRollIt = true, effect = 0, rollMode:string):Promise<void> {
    const rollDamage = game.settings.get("twodsix", "automateDamageRollOnHit") || justRollIt;
    const success = effect >= 0;
    const doesDamage = item?.data?.data?.damage != null;
    let damage:Roll;
    if (success && rollDamage && doesDamage) {
      const damageFormula = item?.data?.data?.damage + (justRollIt ? "" : "+" + effect);
      const damageRoll = new Roll(damageFormula, {});
      damage = damageRoll.roll();
      const contentData = {
        flavor: justRollIt ? `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${item?.name}` : `${game.i18n.localize("TWODSIX.Rolls.AdjustedDamage")} (${damage.formula}):`,
        roll: damage,
        damage: damage.total
      };

      const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);

      const messageData = {
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({actor: actor}),
        content: html,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        roll: damage,
        rollMode: rollMode
      };

      messageData["flags.transfer"] = JSON.stringify(
        {
          type: 'damageItem',
          payload: contentData
        }
      );

      CONFIG.ChatMessage.entityClass.create(messageData).then((arg) => {
        console.log(arg);
      });

    }
  }

  private static async _handleThrows(dataset:DOMStringMap, actor:TwodsixActor, item:TwodsixItem | null, showEffect:boolean, characteristic, skill:TwodsixItem | null, showRollDialog:boolean) {
    let rollParts:string[] = [];
    const speaker = ChatMessage.getSpeaker({actor: actor});
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    const rollMode = game.settings.get('core', 'rollMode');
    const difficulty = skill ? difficulties[skill.data.data.difficulty] : difficulties.Average;
    const skillModifier = item ? item?.data?.data?.skillModifier : 0;

    let settings:throwSettings = {
      shouldRoll: false,
      rollType: "Normal",
      rollMode: rollMode,
      difficulty: difficulty,
      skillModifier: skillModifier,
      characteristic: characteristic
    };

    if (dataset.roll) {
      rollParts = dataset.roll?.split("+");
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
      const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];

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
      if (settings.skillModifier && settings.skillModifier !== 0) {
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

      const roll = new Roll(rollParts.filter(function (el) {
        return el != '' && el;
      }).join('+'), data);

      //Do the throw
      roll.roll();

      let effect;
      if (showEffect) {
        effect = roll.total;
      } else {
        effect = roll.total - difficulty.target;
      }


      /* Builds fine locally, but got this on github action for some reason, so commenting out:
      *  [tsl] ERROR in /home/runner/work/twodsix-foundryvtt/twodsix-foundryvtt/src/module/utils/TwodsixRolls.ts(255,35)
      * TS2352: Conversion of type 'object[]' to type 'number[]' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
      * Type 'object' is not comparable to type 'number'.
      * */

      //Handle special results
      const diceValues:number[] = <number[]><unknown>roll.dice[0].results;

      //TODO #168 Uncomment natural 2/12 handling below, once there is a setting to enable it
      if (diceValues[0] + diceValues[1] === 2) {
        console.log("Got a natural 2!");
        if (0 <= effect) {
          //effect = -1;
        }
      } else if (diceValues[0] + diceValues[1] === 12) {
        console.log("Got a natural 12!");
        if (effect < 0) {
          //effect = 0;
        }
      }

      //TODO #120 Handle critical success/failure once there is a system setting (or two) for it, maybe just show in chat card?
      const TODO_UNHARDCODEME_ISSUE_120 = 6;
      if (effect >= TODO_UNHARDCODEME_ISSUE_120) {
        console.log("Got a critical success");
      } else if (effect <= -TODO_UNHARDCODEME_ISSUE_120) {
        console.log("Got a critical failure");
      }

      //And send to chat
      await roll.toMessage(
        {
          speaker: speaker,
          flavor: flavor
        },
        {rollMode: rollMode}
      );

      //With possible followup
      await this.rollDamage(item, showEffect, actor, false, effect, rollMode);
    }
  }
}
