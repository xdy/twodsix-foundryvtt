import TwodsixItem from './item-base.js';

/**
 * Document class for ship_position item type.
 * Ship positions skip encumbrance/TL-tab refresh since they are never physical items.
 * @extends {TwodsixItem}
 */
export class ShipPositionItem extends TwodsixItem {

  /** @override */
  async _onUpdate(_changed, _options, _userId) {
    // ship_position items never need encumbrance checks or TL tab refresh.
    // Call grandparent (Item) directly to skip TwodsixItem._onUpdate logic.
    await Item.prototype._onUpdate.call(this, _changed, _options, _userId);
  }
}
