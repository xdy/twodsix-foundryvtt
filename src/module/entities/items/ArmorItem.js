import { GearItem } from './GearItem.js';

/**
 * Document class for armor item type.
 * @extends {GearItem}
 */
export class ArmorItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return null;
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    // Warn when nonstackable is being turned on while actor already wears multiple equipped armor layers
    if (data.system?.nonstackable === true && !this.system.nonstackable) {
      if (this.actor && this.system.equipped === 'equipped' && this.actor.system.layersWorn > 1) {
        ui.notifications.warn("TWODSIX.Warnings.WearingMultipleLayers", {localize: true});
      }
    }
    return allowed;
  }
}
