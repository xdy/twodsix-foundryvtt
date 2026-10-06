import TwodsixItem from './BaseItem.js';

/**
 * Document class for career item type.
 * @extends {TwodsixItem}
 */
export class CareerItem extends TwodsixItem {
  /** @override */
  _getDefaultIcon() {
    return 'icons/svg/book.svg';
  }
}
