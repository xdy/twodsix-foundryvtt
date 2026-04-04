import TwodsixItem from './item-base.js';

/**
 * Document class for chargen_ruleset item type.
 * @extends {TwodsixItem}
 */
export class ChargenRulesetItem extends TwodsixItem {
  /** @override */
  _getDefaultIcon() {
    return 'icons/svg/book.svg';
  }
}
