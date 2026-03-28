import TwodsixActor from './actor-base.js';

/**
 * Intermediate base class for vehicle-type actors: ship, vehicle, space-object.
 * Holds shared logic for all three types.
 * @extends {TwodsixActor}
 */
export class TwodsixVehicleBaseActor extends TwodsixActor {

  /**
   * Vehicle-type actors have no characteristic scores used for skill rolls.
   * @override
   * @returns {number}
   */
  getCharacteristicModifier(characteristic) {
    return 0;
  }
}
