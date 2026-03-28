import { GearItem } from './GearItem.js';

/**
 * Document class for consumable item type.
 * @extends {GearItem}
 */
export class ConsumableItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    // Auto-set isAttachment when subtype changes to a software/processor/suite type
    if (data.system?.subtype !== undefined && ["software", "processor", "suite"].includes(data.system.subtype)) {
      foundry.utils.setProperty(data, "system.isAttachment", true);
    }
    return allowed;
  }

  //////// CONSUMABLE ////////
  /**
   * A function decrement a consumable selected consumbles from inventory.
   * @param {number} quantity The amount to decrement consumable count
   * @returns {Promise<void>}
   */
  async consume(quantity) {
    const consumableLeft = (this.system).currentCount - quantity;
    if (consumableLeft >= 0) {
      await this.update({"system.currentCount": consumableLeft}, {});
    } else {
      throw {name: 'NoAmmoError'};
    }
  }

  /**
   * A function refill selected consumbles from inventory.
   * @returns {Promise<void>}
   */
  async refill() {
    const consumable = this.system;
    if (consumable.currentCount < consumable.max) {
      if (consumable.quantity > 1) {
        //Make a duplicate and add to inventory if not empty
        if (consumable.currentCount > 0) {
          const partialConsumable = foundry.utils.duplicate(this);
          (partialConsumable.system).quantity = 1;
          await this.actor?.createEmbeddedDocuments("Item", [partialConsumable]);
        }
        //refill quantity
        await this.update({
          "system.quantity": consumable.quantity - 1,
          "system.currentCount": consumable.max
        }, {});
      } else {
        throw {name: 'TooLowQuantityError'};
      }
    }
  }
}
