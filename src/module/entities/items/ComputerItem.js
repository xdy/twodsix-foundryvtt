import { GearItem } from './GearItem.js';

/**
 * Document class for computer item type.
 * @extends {GearItem}
 */
export class ComputerItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return 'systems/twodsix/assets/icons/components/computer.svg';
  }
}
