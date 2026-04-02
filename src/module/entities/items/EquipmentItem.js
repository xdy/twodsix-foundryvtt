import { GearItem } from './GearItem.js';

/**
 * Document class for equipment item type.
 * @extends {GearItem}
 */
export class EquipmentItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }
}
