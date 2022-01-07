/**
 * @extends {Item}
 */

import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import TwodsixActor from "./TwodsixActor";
import { DICE_ROLL_MODES } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Consumable, Gear, Skills, UsesConsumables, Weapon} from "../../types/template";


export default class TwodsixItem extends Item {
  public static async create(data, options?): Promise<TwodsixItem> {
    const item = await super.create(data, options) as unknown as TwodsixItem;
    item?.setFlag('twodsix', 'newItem', true);
    if (item?.data.type === 'weapon' && (item.data.img === "" || item.data.img === foundry.data.ItemData.DEFAULT_ICON)) {
      await item.update({'img': 'systems/twodsix/assets/icons/default_weapon.png'});
    }

    return item;
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData(): void {
    super.prepareData();
    if (this.getFlag("twodsix", "untrainedSkill")) {
      this.data.name = game.i18n.localize("TWODSIX.Actor.Skills.Untrained");
    }
  }

  prepareConsumable(gear: Gear = <Gear>this.data.data): void {
    if (gear.consumables !== undefined && gear.consumables.length > 0 && this.actor != null) {

      //TODO What is consumableData? Where does it come from? Not in template.json
      gear.consumableData = gear.consumables.map((consumableId: string) => {
        return this.actor?.items.filter((item) => item.id === consumableId)[0];
      });
      gear.consumableData.sort((a, b) => {
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
    }
  }

  public async addConsumable(consumableId: string, gear: Gear = <Gear>this.data.data): Promise<void> {
    if (gear.consumables != undefined) {
      if (gear.consumables.includes(consumableId)) {
        console.error(`Twodsix | Consumable already exists for item ${this.id}`);
      } else {
        await this.update({"data.consumables": gear.consumables.concat(consumableId)}, {});
      }
    } else {
      ui.notifications.error(`Twodsix | Consumable can't be added to item ${this.id}`);
    }
  }

  public async removeConsumable(consumableId: string, gear: Gear = <Gear>this.data.data): Promise<void> {
    const updatedConsumables = gear.consumables.filter((cId: string) => {
      return (cId !== consumableId && cId !== null && this.actor?.items.get(cId) !== undefined);
    });
    const updateData = {"data.consumables": updatedConsumables};
    if (gear.useConsumableForAttack === consumableId) {
      updateData["data.useConsumableForAttack"] = "";
    }
    await this.update(updateData, {});
  }

  //////// WEAPON ////////

  public async performAttack(attackType: string, showThrowDialog: boolean, rateOfFireCE: number | null = null, showInChat = true, weapon: Weapon = <Weapon>this.data.data): Promise<void> {
    if (this.type !== "weapon") {
      return;
    }
    if (!weapon.skill) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
      return;
    }

    let numberOfAttacks = 1;
    let bonusDamage = "0";
    const rof = parseInt(weapon.rateOfFire, 10);
    const rateOfFire: number = rateOfFireCE ?? (!isNaN(rof) ? rof : 0);
    if (attackType && !rateOfFire) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoROFForAttack"));
    }
    const skill: TwodsixItem = this.actor?.items.get(weapon.skill) as TwodsixItem;
    let tmpSettings: { characteristic?: string | undefined, diceModifier?: number | undefined } = {
      characteristic: undefined,
      diceModifier: undefined
    };
    if (skill) {
      tmpSettings = {characteristic: (<Skills>skill.data.data).characteristic || 'NONE'};
    }

    let usedAmmo = 1;
    switch (attackType) {
      case "auto-full":
        numberOfAttacks = rateOfFire;
        usedAmmo = 3 * rateOfFire;
        break;
      case "auto-burst":
        bonusDamage = rateOfFire.toString();
        usedAmmo = parseInt(weapon.rateOfFire, 10);
        break;
      case "burst-attack-dm":
        tmpSettings.diceModifier = TwodsixItem.burstAttackDM(rateOfFireCE);
        usedAmmo = rateOfFireCE || 0;
        break;
      case "burst-bonus-damage":
        bonusDamage = TwodsixItem.burstBonusDamage(rateOfFireCE);
        usedAmmo = rateOfFireCE || 0;
        break;
    }

    const settings: TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, this);

    if (!settings.shouldRoll) {
      return;
    }

    if (weapon.useConsumableForAttack) {
      const magazine = this.actor?.items.get(weapon.useConsumableForAttack) as TwodsixItem;
      if (magazine) {
        try {
          await magazine.consume(usedAmmo);
        } catch (err) {
          if (err.name == "NoAmmoError") {
            ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoAmmo"));
            return;
          } else {
            throw err;
          }
        }
      }
    }

    for (let i = 0; i < numberOfAttacks; i++) {
      const roll = await this.skillRoll(false, settings, showInChat);
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll && roll.isSuccess()) {
        const damage = await this.rollDamage(settings.rollMode, `${roll.effect} + ${bonusDamage}`, showInChat) || null;
        if (game.user?.targets.size === 1) {
          game.user?.targets.values().next().value.actor.damageActor(damage.total);
        } else if (game.user?.targets && game.user?.targets.size > 1) {
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.AutoDamageForMultipleTargetsNotImplemented"));
        }
      }
    }
  }

  public async skillRoll(showThrowDialog: boolean, tmpSettings: TwodsixRollSettings | null = null, showInChat = true): Promise<TwodsixDiceRoll | void> {
    let skill: TwodsixItem | null = null;
    let item: TwodsixItem | undefined;

    // Determine if this is a skill or an item
    const usesConsumable = <UsesConsumables>this.data.data;
    if (this.type == "skills") {
      skill = this;
      item = undefined;
    } else if (usesConsumable.skill) {
      skill = this.actor?.items.get(usesConsumable.skill) as TwodsixItem;
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

    /* Decrement the item's consumable by one if present and not a weapon (attack role handles separately)*/
    if (usesConsumable.useConsumableForAttack && item && item.data.type != "weapon") {
      const magazine = <TwodsixItem>this.actor?.items.get(usesConsumable.useConsumableForAttack);
      if (magazine) {
        try {
          await magazine.consume(1);
        } catch (err) {
          if (err.name == "NoAmmoError") {
            ui.notifications.error(game.i18n.localize("TWODSIX.Errors.EmptyConsumable"));
            return;
          } else {
            throw err;
          }
        }
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.EmptyConsumable"));
        return;
      }
    }
    const diceRoll = new TwodsixDiceRoll(tmpSettings, <TwodsixActor>this.actor, skill, item);

    if (showInChat) {
      await diceRoll.sendToChat();
    }
    return diceRoll;
  }

  public async rollDamage(rollMode: DICE_ROLL_MODES, bonusDamage = "", showInChat = true): Promise<Roll> {
    const weapon = <Weapon>this.data.data;
    const doesDamage = weapon.damage != null;
    if (!doesDamage) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoDamageForWeapon"));
    }

    const damageFormula = weapon.damage + (bonusDamage ? "+" + bonusDamage : "");
    const damageRoll = new Roll(damageFormula, this.actor?.data.data);
    const damage: Roll = await damageRoll.evaluate({async: true}); // async: true will be default in foundry 0.10
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
        speaker: this.actor ? ChatMessage.getSpeaker({actor: this.actor}) : "???",
        content: html,
        flags: {
          "core.canPopout": true,
          "transfer": transfer
        }
      }, {rollMode: rollMode});
    }
    return damage;
  }

  public static burstAttackDM(number: number | null): number {
    if (number === null) {
      return 0;
    }
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

  public static burstBonusDamage(number: number | null): string {
    if (number === null) {
      return '0';
    }
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

  public static simplifySkillName(skillName:string): string {
    return skillName.replace(/\W/g, "");
  }

  //////// CONSUMABLE ////////
  public async consume(quantity: number): Promise<void> {
    const consumableLeft = (<Consumable>this.data.data).currentCount - quantity;
    if (consumableLeft >= 0) {
      await this.update({"data.currentCount": consumableLeft}, {});
    } else {
      throw {name: 'NoAmmoError'};
    }
  }

  public async refill(): Promise<void> {
    const consumable = <Consumable>this.data.data;
    if (consumable.quantity > 1) {
      await this.update({
        "data.quantity": consumable.quantity - 1,
        "data.currentCount": consumable.max
      }, {});
    } else {
      throw {name: 'TooLowQuantityError'};
    }
  }
}
