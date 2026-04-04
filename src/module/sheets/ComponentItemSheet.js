import { COMPONENT_SUBTYPES, TWODSIX } from '../config';
import { TwodsixItemSheet } from './TwodsixItemSheet';

export class ComponentItemSheet extends TwodsixItemSheet {
  getApplicableTabs(tabs) {
    delete tabs.magazine;
    delete tabs.modifiers;
    if (this.item.system.isStoredInCargo) {
      delete tabs.power;
    }
    if (!this.item.system.isWeapon && !this.item.system.canBePopup) {
      delete tabs.attack;
    }
    delete tabs.chargenRuleset;
    delete tabs.career;
    return tabs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Custom drive type labels
    if (this.item.system.subtype === COMPONENT_SUBTYPES.DRIVE) {
      context.config.DriveTypes.jdrive = game.settings.get("twodsix", "jDriveLabel") || TWODSIX.DriveTypes.jdrive;
      context.config.DriveTypes.mdrive = game.settings.get("twodsix", "mDriveLabel") || TWODSIX.DriveTypes.mdrive;
    }
    // Ammo list for armament components
    context.ammoList = {none: game.i18n.localize("TWODSIX.Ship.None")};
    if (this.item.system.isArmament && this.item.actor) {
      (this.item.actor).itemTypes.component
        ?.filter(i => i.system.subtype === COMPONENT_SUBTYPES.AMMO)
        ?.forEach(a => context.ammoList[a.id] = a.name);
    }
    // Disable invalid pricing options for ammo
    if (this.item.system.hullPricingForbidden) {
      delete context.config.PricingOptions.perHullTon;
      delete context.config.PricingOptions.per100HullTon;
      delete context.config.PricingOptions.pctHull;
      delete context.config.PricingOptions.pctHullPerUnit;
    }
    return context;
  }
}
