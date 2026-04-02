import { COMPONENT_SUBTYPES } from '../../../config.js';
import { ComponentData } from '../../../data/items/componentData.js';
import TwodsixItem from '../item-base.js';

/**
 * Base document class for all component subtypes.
 * Subtype-specific subclasses are dispatched via the Item Proxy in twodsix.js.
 * @extends {TwodsixItem}
 */
export class BaseComponentItem extends TwodsixItem {

  /** @override */
  _getDefaultIcon() {
    return `systems/twodsix/assets/icons/components/${this.system?.subtype ?? COMPONENT_SUBTYPES.OTHER}.svg`;
  }

  /** @override */
  async _resolveSkillAndItem(tmpSettings) {
    const workingActor = await fromUuid(tmpSettings?.flags?.actorUUID);
    const skill = workingActor?.items.getName(tmpSettings?.skillName) ?? null;
    return { skill, item: this, workingActor };
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);

    if (data.system?.subtype !== undefined) {
      const chosenSubtype = data.system.subtype;

      // Update default image when using the standard component icon path
      const componentImagePath = "systems/twodsix/assets/icons/components/";
      if (this.img.includes(componentImagePath)) {
        foundry.utils.setProperty(data, "img", componentImagePath + chosenSubtype + ".svg");
      }

      const anComponent = this.system;
      const constraints = ComponentData.constraintsForSubtype(chosenSubtype);

      if (anComponent.weightIsPct && constraints.weightIsPctForbidden) {
        foundry.utils.setProperty(data, "system.weightIsPct", false);
      }

      if (!constraints.isBaseHullAllowed && anComponent.isBaseHull) {
        foundry.utils.setProperty(data, "system.isBaseHull", false);
      }

      if (!constraints.canBeHardened && anComponent.hardened) {
        foundry.utils.setProperty(data, "system.hardened", false);
      }

      if (constraints.hullPricingForbidden && !["perUnit", "perCompTon"].includes(anComponent.pricingBasis)) {
        foundry.utils.setProperty(data, "system.pricingBasis", "perUnit");
      }
    }

    // Enforce isBaseHull → weightIsPct: false constraint
    if (data.system?.isBaseHull === true && !this.system.isBaseHull && this.system.weightIsPct) {
      foundry.utils.setProperty(data, "system.weightIsPct", false);
    }

    return allowed;
  }

  /**
   * Checks if this component is a J-Drive (Jump Drive).
   * Override in DriveComponentItem; returns false for all other subtypes.
   * @returns {boolean}
   */
  isJDriveComponent() {
    return false;
  }

  /**
   * Checks if this component is an M-Drive (Maneuver Drive).
   * Override in DriveComponentItem; returns false for all other subtypes.
   * @returns {boolean}
   */
  isMDriveComponent() {
    return false;
  }
}
