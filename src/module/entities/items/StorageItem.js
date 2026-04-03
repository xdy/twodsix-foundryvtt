import { GearItem } from './GearItem.js';

/**
 * Document class for storage item type.
 * @extends {GearItem}
 */
export class StorageItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }
}
