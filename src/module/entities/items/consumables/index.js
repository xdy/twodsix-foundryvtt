import { CONSUMABLE_SUBTYPES } from '../../../config.js';
import { BaseConsumableItem } from './BaseConsumableItem.js';
import { GenericConsumableItem } from './GenericConsumableItem.js';
import { MagazineConsumableItem } from './MagazineConsumableItem.js';
import { PowerCellConsumableItem } from './PowerCellConsumableItem.js';
import { ProcessorConsumableItem } from './ProcessorConsumableItem.js';
import { SoftwareConsumableItem } from './SoftwareConsumableItem.js';
import { SuiteConsumableItem } from './SuiteConsumableItem.js';

export {
  BaseConsumableItem,
  GenericConsumableItem,
  MagazineConsumableItem,
  PowerCellConsumableItem,
  ProcessorConsumableItem,
  SoftwareConsumableItem,
  SuiteConsumableItem,
};

/**
 * Maps consumable subtype strings to their document subclasses.
 * Used by the Item Proxy in twodsix.js to construct the right class per subtype.
 */
export const CONSUMABLE_SUBTYPE_CLASSES = Object.freeze({
  [CONSUMABLE_SUBTYPES.SOFTWARE]: SoftwareConsumableItem,
  [CONSUMABLE_SUBTYPES.PROCESSOR]: ProcessorConsumableItem,
  [CONSUMABLE_SUBTYPES.SUITE]: SuiteConsumableItem,
  [CONSUMABLE_SUBTYPES.MAGAZINE]: MagazineConsumableItem,
  [CONSUMABLE_SUBTYPES.POWER_CELL]: PowerCellConsumableItem,
  // All remaining subtypes use GenericConsumableItem
  [CONSUMABLE_SUBTYPES.AIR]: GenericConsumableItem,
  [CONSUMABLE_SUBTYPES.DRUGS]: GenericConsumableItem,
  [CONSUMABLE_SUBTYPES.FOOD]: GenericConsumableItem,
  [CONSUMABLE_SUBTYPES.FUEL]: GenericConsumableItem,
  [CONSUMABLE_SUBTYPES.OTHER]: GenericConsumableItem,
  _default: GenericConsumableItem,
});
