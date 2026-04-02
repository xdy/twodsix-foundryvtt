import { TWODSIX } from '../../config';
import { TwodsixVehicleBaseActor } from './TwodsixVehicleBaseActor.js';

/**
 * Actor document class for vehicle-type actors.
 * @extends {TwodsixVehicleBaseActor}
 */
export class VehicleActor extends TwodsixVehicleBaseActor {

  /** @override */
  _getDefaultImage() {
    return game.settings.get("twodsix", "themeStyle") === "western"
      ? 'systems/twodsix/assets/icons/old-wagon.png'
      : 'systems/twodsix/assets/icons/default_vehicle.png';
  }

  /** @override */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    if (![...TWODSIX.WeightlessItems, "cargo"].includes(droppedItem.type)) {
      return await this._addDroppedEquipment(droppedItem);
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }

}
