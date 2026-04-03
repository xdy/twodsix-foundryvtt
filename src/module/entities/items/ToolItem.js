import { GearItem } from './GearItem.js';

/**
 * Document class for tool item type.
 * @extends {GearItem}
 */
export class ToolItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }
}
