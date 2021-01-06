/**
 * @extends {Item}
 */

import {TwodsixDiceRoll} from "../utils/TwodsixDiceRoll";
import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import TwodsixActor from "./TwodsixActor";

export default class TwodsixItem extends Item {
  public static async create(data:Record<string, unknown>, options?:Record<string, unknown>):Promise<Entity> {
    const item = await super.create(data, options) as TwodsixItem;
    item.setFlag('twodsix', 'newItem', true);
    return item;
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();
  }

  public async performAttack(attackType:string, showThrowDialog:boolean, rateOfFireCE:number = null, showInChat = true):Promise<void> {
    if (this.type !== "weapon") {
      return;
    }

    let numberOfAttacks = 1;
    let bonusDamage = "0";
    const rateOfFire = this.data.data.rateOfFire;

    if (attackType && !rateOfFire) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoROFForAttack"));
    }
    const skill:TwodsixItem = this.actor.getOwnedItem(this.data.data.skill) as TwodsixItem;
    const tmpSettings = {"characteristic": skill?.data.data.characteristic || 'NONE'};

    switch (attackType) {
      case "auto-full":
        numberOfAttacks = parseInt(rateOfFire, 10);
        break;
      case "auto-burst":
        bonusDamage = rateOfFire;
        break;
      case "burst-attack-dm":
        tmpSettings["diceModifier"] = TwodsixItem.burstAttackDM(rateOfFireCE);
        break;
      case "burst-bonus-damage":
        bonusDamage = TwodsixItem.burstBonusDamage(rateOfFireCE);
        break;
    }

    const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, this);

    if (!settings.shouldRoll) {
      return;
    }

    for (let i = 0; i < numberOfAttacks; i++) {
      const roll = await this.skillRoll(false, settings, showInChat);
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll.isSuccess()) {
        await this.rollDamage(settings.rollMode, `${roll.effect} + ${bonusDamage}`, showInChat);
      }
    }
  }


  public async skillRoll(showThrowDialog:boolean, tmpSettings:TwodsixRollSettings = null, showInChat = true):Promise<TwodsixDiceRoll> {
    let skill:TwodsixItem;
    let item:TwodsixItem;

    // Determine if this is a skill or an item
    if (this.type == "skills") {
      skill = this;
      item = null;
    } else if (this.data.data.skill) {
      skill = this.actor.getOwnedItem(this.data.data.skill) as TwodsixItem;
      item = this;
    }

    //TODO Refactor. This is an ugly fix for weapon attacks, when settings are first created, then skill rolls are made, creating new settings, so multiplying bonuses.
    if (!tmpSettings) {
      tmpSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, item);
      if (!tmpSettings.shouldRoll) {
        return;
      }
    }

    const diceRoll = new TwodsixDiceRoll(tmpSettings, <TwodsixActor>this.actor, skill, item);

    if (showInChat) {
      diceRoll.sendToChat();
    }
    console.log("DEBUG ROLL:", diceRoll);
    return diceRoll;
  }

  public async rollDamage(rollMode:string, bonusDamage = "", showInChat = true):Promise<Roll> {
    const doesDamage = this.data.data.damage != null;
    if (!doesDamage) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoDamageForWeapon"));
    }

    const damageFormula = this.data.data.damage + (bonusDamage ? "+" + bonusDamage : "");
    const damageRoll = new Roll(damageFormula, {});
    const damage:Roll = damageRoll.roll();
    if (showInChat) {
      const results = damage.terms[0]["results"];
      const contentData = {
        flavor: `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${this.name}`,
        roll: damage,
        damage: damage.total,
        dice: results
      };

      const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);

      const messageData = {
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
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

      ChatMessage.create(messageData, {rollMode: rollMode});
    }
    console.log("DEBUG DAMAGE ROLL:", damageRoll);
    return damageRoll;
  }

  public static burstAttackDM(number:number):number {
    if (number >= 100) {
      return 4;
    } else if (number >= 20) {
      return 3;
    } else if (number >= 10) {
      return 2;
    } else if (number >= 3) {
      return 1;
    } else {
      return 0;
    }
  }

  public static burstBonusDamage(number:number):string {
    if (number >= 100) {
      return '4d6';
    } else if (number >= 20) {
      return '3d6';
    } else if (number >= 10) {
      return '2d6';
    } else if (number >= 4) {
      return '1d6';
    } else if (number >= 3) {
      return '1';
    } else {
      return '0';
    }
  }
}
