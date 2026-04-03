import { COMPONENT_SUBTYPES } from '../../../config.js';
import { AmmoComponentItem } from './AmmoComponentItem.js';
import { ArmamentComponentItem } from './ArmamentComponentItem.js';
import { BaseComponentItem } from './BaseComponentItem.js';
import { CargoComponentItem } from './CargoComponentItem.js';
import { ComputerComponentItem } from './ComputerComponentItem.js';
import { DriveComponentItem } from './DriveComponentItem.js';
import { FuelComponentItem } from './FuelComponentItem.js';
import { GenericComponentItem } from './GenericComponentItem.js';
import { HullComponentItem } from './HullComponentItem.js';
import { SoftwareComponentItem } from './SoftwareComponentItem.js';

export {
  AmmoComponentItem,
  ArmamentComponentItem,
  BaseComponentItem,
  CargoComponentItem,
  ComputerComponentItem,
  DriveComponentItem,
  FuelComponentItem,
  GenericComponentItem,
  HullComponentItem,
  SoftwareComponentItem,
};

/**
 * Maps component subtype strings to their document subclasses.
 * Used by the Item Proxy in twodsix.js to construct the right class per subtype.
 */
export const COMPONENT_SUBTYPE_CLASSES = Object.freeze({
  [COMPONENT_SUBTYPES.AMMO]: AmmoComponentItem,
  [COMPONENT_SUBTYPES.ARMAMENT]: ArmamentComponentItem,
  [COMPONENT_SUBTYPES.CARGO]: CargoComponentItem,
  [COMPONENT_SUBTYPES.COMPUTER]: ComputerComponentItem,
  [COMPONENT_SUBTYPES.DRIVE]: DriveComponentItem,
  [COMPONENT_SUBTYPES.FUEL]: FuelComponentItem,
  [COMPONENT_SUBTYPES.HULL]: HullComponentItem,
  [COMPONENT_SUBTYPES.SOFTWARE]: SoftwareComponentItem,
  // All remaining subtypes use GenericComponentItem
  [COMPONENT_SUBTYPES.ACCOMMODATIONS]: GenericComponentItem,
  [COMPONENT_SUBTYPES.ARMOR]: GenericComponentItem,
  [COMPONENT_SUBTYPES.BRIDGE]: GenericComponentItem,
  [COMPONENT_SUBTYPES.DOCK]: GenericComponentItem,
  [COMPONENT_SUBTYPES.DRONE]: GenericComponentItem,
  [COMPONENT_SUBTYPES.ELECTRONICS]: GenericComponentItem,
  [COMPONENT_SUBTYPES.MOUNT]: GenericComponentItem,
  [COMPONENT_SUBTYPES.OTHER]: GenericComponentItem,
  [COMPONENT_SUBTYPES.OTHER_EXTERNAL]: GenericComponentItem,
  [COMPONENT_SUBTYPES.OTHER_INTERNAL]: GenericComponentItem,
  [COMPONENT_SUBTYPES.POWER]: GenericComponentItem,
  [COMPONENT_SUBTYPES.SENSOR]: GenericComponentItem,
  [COMPONENT_SUBTYPES.SHIELD]: GenericComponentItem,
  [COMPONENT_SUBTYPES.STORAGE]: GenericComponentItem,
  [COMPONENT_SUBTYPES.VEHICLE]: GenericComponentItem,
  _default: GenericComponentItem,
});
