/**
 * @extends {Item}
 */

import {TwodsixDiceRoll} from "../utils/TwodsixDiceRoll";
import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import TwodsixActor from "./TwodsixActor";

// @ts-ignore
export default class TwodsixItem extends Item {
  public static async create(data:Record<string, unknown>, options?:Record<string, unknown>):Promise<Entity> {
    const item = await super.create(data, options) as TwodsixItem;
    item.setFlag('twodsix', 'newItem', true);
    if (item.data.type ==='weapon') {
      await item.update({'img': 'systems/twodsix/assets/icons/default_weapon.png'});
    }
    return item;
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();
    if (this.getFlag("twodsix", "untrainedSkill")) {
      this.data.name = game.i18n.localize("TWODSIX.Actor.Skills.Untrained");
    }
  }

  prepareConsumable():void {
    if (this.data.data.consumables !== undefined && this.data.data.consumables.length > 0 && this.actor != null) {
      this.data.data.consumableData = this.data.data.consumables.map((consumableId:string) => {
        return this.actor.items.filter((item) => item.id === consumableId)[0];
      });
      this.data.data.consumableData.sort((a:TwodsixItem, b:TwodsixItem) => {
        return ((a.name > b.name) ? -1 : ((a.name > b.name) ? 1 : 0));
      });
    }
  }

  public async addConsumable(consumableId:string):Promise<void> {
    if (this.data.data.consumables.includes(consumableId)) {
      console.error(`Twodsix | Consumable already exists for item ${this.id}`);
      return;
    }
    await this.update({"data.consumables": this.data.data.consumables.concat(consumableId)}, {});
  }

  public async removeConsumable(consumableId: string):Promise<void> {
    const updatedConsumables = this.data.data.consumables.filter((cId:string) => {
      return (cId !== consumableId && cId!==null && this.actor.items.get(cId) !== undefined);
    });
    const updateData = {"data.consumables": updatedConsumables};
    if (this.data.data.useConsumableForAttack === consumableId) {
      updateData["data.useConsumableForAttack"] = "";
    }
    await this.update(updateData, {});
  }

  //////// WEAPON ////////

  public async performAttack(attackType:string, showThrowDialog:boolean, rateOfFireCE:number = null, showInChat = true):Promise<void> {
    if (this.type !== "weapon") {
      return;
    }
    if (!this.data.data.skill) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
      return;
    }

    let numberOfAttacks = 1;
    let bonusDamage = "0";
    const rof = parseInt(this.data.data.rateOfFire, 10);
    const rateOfFire:number = rateOfFireCE ?? (!isNaN(rof) ? rof : 0);
    if (attackType && !rateOfFire) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoROFForAttack"));
    }
    const skill:TwodsixItem = this.actor.items.get(this.data.data.skill) as TwodsixItem;
    const tmpSettings = {"characteristic": skill?.data.data.characteristic || 'NONE'};

    let usedAmmo = 1;
    switch (attackType) {
      case "auto-full":
        numberOfAttacks = rateOfFire;
        usedAmmo = 3 * rateOfFire;
        break;
      case "auto-burst":
        bonusDamage = rateOfFire.toString();
        usedAmmo = parseInt(this.data.data.rateOfFire, 10);
        break;
      case "burst-attack-dm":
        tmpSettings["diceModifier"] = TwodsixItem.burstAttackDM(rateOfFireCE);
        usedAmmo = rateOfFireCE;
        break;
      case "burst-bonus-damage":
        bonusDamage = TwodsixItem.burstBonusDamage(rateOfFireCE);
        usedAmmo = rateOfFireCE;
        break;
    }

    const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, this);

    if (!settings.shouldRoll) {
      return;
    }

    if (this.data.data.useConsumableForAttack) {
      const magazine = this.actor.items.get(this.data.data.useConsumableForAttack) as TwodsixItem;
      try {
        await magazine.consume(usedAmmo);
      } catch(err) {
        if (err.name == "NoAmmoError") {
          ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoAmmo"));
          return;
        } else {
          throw err;
        }
      }
    }

    for (let i = 0; i < numberOfAttacks; i++) {
      const roll = await this.skillRoll(false, settings, showInChat);
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll.isSuccess()) {
        const damage = await this.rollDamage(settings.rollMode, `${roll.effect} + ${bonusDamage}`, showInChat);
        if (game.user.targets.size === 1) {
          game.user.targets.values().next().value.actor.damageActor(damage.total);
        } else if (game.user.targets.size > 1){
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.AutoDamageForMultipleTargetsNotImplemented"));
        }
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
      skill = this.actor.items.get(this.data.data.skill) as TwodsixItem;
      item = this;
    }

    if (!skill) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
      return;
    }

    //TODO Refactor. This is an ugly fix for weapon attacks, when settings are first created, then skill rolls are made, creating new settings, so multiplying bonuses.
    if (!tmpSettings) {
      tmpSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, item);
      if (!tmpSettings.shouldRoll) {
        return;
      }
    }

    // @ts-ignore
    const diceRoll = new TwodsixDiceRoll(tmpSettings, <TwodsixActor>this.actor, skill, item);

    if (showInChat) {
      await diceRoll.sendToChat();
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
    const damageRoll = Roll.create(damageFormula, this.actor.data.data);
    // @ts-ignore
    const damage:Roll = await damageRoll.evaluate({async: true}); // async: true will be default in foundry 0.10
    if (showInChat) {
      const results = damage.terms[0]["results"];
      const contentData = {
        flavor: `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${this.name}`,
        roll: damage,
        damage: damage.total,
        dice: results
      };

      const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);
      const transfer = JSON.stringify(
        {
          type: 'damageItem',
          payload: contentData
        }
      );
      await damage.toMessage({
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        content: html,
        flags: {
          "core.canPopout": true,
          "transfer": transfer
        }
      // @ts-ignore
      }, { rollMode: rollMode });
    }
    console.log("DEBUG DAMAGE ROLL:", damage);
    return damage;
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

  //////// CONSUMABLE ////////
  public async consume(quantity:number):Promise<void> {
    const consumableLeft = this.data.data.currentCount - quantity;
    if (consumableLeft >= 0) {
      await this.update({"data.currentCount": consumableLeft}, {});
    } else {
      throw {name: 'NoAmmoError'};
    }
  }

  public async refill():Promise<void> {
    if (this.data.data.quantity > 1) {
      await this.update({
        "data.quantity": this.data.data.quantity - 1,
        "data.currentCount": this.data.data.max
      }, {});
    } else {
      throw {name: 'TooLowQuantityError'};
    }
  }
}
