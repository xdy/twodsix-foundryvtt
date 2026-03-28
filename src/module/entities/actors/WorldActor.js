import TwodsixActor from './actor-base.js';

/**
 * Actor document class for world-type actors (planetary/location actors for trading).
 * @extends {TwodsixActor}
 */
export class WorldActor extends TwodsixActor {

  /** @override */
  _getDefaultImage() {
    return 'systems/twodsix/assets/icons/default_world.png';
  }

  /** @override */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    // Check for cargo trade from ship
    const cargoRowFromShip = this.buildCargoRowFromItem(droppedItem);
    if (cargoRowFromShip && droppedItem.actor?.type === "ship") {
      await droppedItem.actor.handleDroppedCargoToWorldFromItem(droppedItem);
      return true;
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }
}
