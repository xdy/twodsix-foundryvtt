import { GearItem } from './GearItem.js';

/**
 * Document class for junk item type.
 * @extends {GearItem}
 */
export class JunkItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }
}
