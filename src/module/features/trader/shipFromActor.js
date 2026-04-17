/**
 * shipFromActor.js
 * Build trader journey ship state from a Foundry ship Actor (shared by entrypoint and other-activities UI).
 */

import { parseCurrencyToMcr } from './TraderUtils.js';

/**
 * Build a ship state object from a ship Actor.
 * @param {Actor} shipActor
 * @param {object} baseShip - Existing state.ship to inherit fields from
 * @returns {object}
 */
export function buildShipFromActor(shipActor, baseShip) {
  const sys = shipActor.system;
  const components = shipActor.itemTypes?.component ?? [];
  const accommodations = components.filter(i => i.system?.subtype === 'accommodations');
  const staterooms = accommodations
    .filter(i => /stateroom/i.test(i.name))
    .reduce((sum, i) => sum + (i.system?.quantity ?? 0), 0);
  const lowBerths = accommodations
    .filter(i => /low berth|cryoberth/i.test(i.name))
    .reduce((sum, i) => sum + (i.system?.quantity ?? 0), 0);
  const armed = components.some(i => i.system?.subtype === 'armament');

  let costMcr = parseCurrencyToMcr(sys.calcShipStats?.cost?.total, true);
  if (costMcr === 0) {
    const rawValue = sys.shipValue || sys.cost || '0';
    costMcr = parseCurrencyToMcr(rawValue, true);
  }

  return {
    ...baseShip,
    name: shipActor.name,
    jumpRating: sys.shipStats?.drives?.jDrive?.rating ?? baseShip.jumpRating,
    maneuverRating: sys.shipStats?.drives?.mDrive?.rating ?? baseShip.maneuverRating,
    tonnage: sys.mass?.max ?? baseShip.tonnage,
    cargoCapacity: sys.weightStats?.cargo ?? baseShip.cargoCapacity,
    fuelCapacity: sys.shipStats?.fuel?.max ?? baseShip.fuelCapacity,
    shipCostMcr: costMcr || baseShip.shipCostMcr || parseCurrencyToMcr(baseShip.shipCost, true) || 0,
    ...(staterooms > 0 && { staterooms }),
    ...(lowBerths > 0 && { lowBerths }),
    armed,
  };
}
