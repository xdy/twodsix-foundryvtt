import { ConsumableData } from '../../../data/items/consumableData.js';
import { GearItem } from '../GearItem.js';

/**
 * Base document class for all consumable subtypes.
 * Subtype-specific subclasses are dispatched via the Item Proxy in twodsix.js.
 * @extends {GearItem}
 */
export class BaseConsumableItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    if (data.system?.subtype !== undefined) {
      const constraints = ConsumableData.constraintsForSubtype(data.system.subtype);
      if (constraints.isAttachmentType) {
        foundry.utils.setProperty(data, "system.isAttachment", true);
      }
    }
    return allowed;
  }

  /**
   * Decrement a consumable's current count.
   * @param {number} quantity The amount to decrement
   * @returns {Promise<void>}
   */
  async consume(quantity) {
    const consumableLeft = this.system.currentCount - quantity;
    if (consumableLeft >= 0) {
      await this.update({"system.currentCount": consumableLeft}, {});
    } else {
      throw {name: 'NoAmmoError'};
    }
  }

  /**
   * Refill a consumable from a stack.
   * @returns {Promise<void>}
   */
  async refill() {
    const consumable = this.system;
    if (consumable.currentCount < consumable.max) {
      if (consumable.quantity > 1) {
        if (consumable.currentCount > 0) {
          const partialConsumable = foundry.utils.duplicate(this);
          partialConsumable.system.quantity = 1;
          await this.actor?.createEmbeddedDocuments("Item", [partialConsumable]);
        }
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
