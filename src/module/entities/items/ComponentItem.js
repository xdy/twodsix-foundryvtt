import TwodsixItem from './item-base.js';

/**
 * Document class for component item type (ship/vehicle components).
 * Components are excluded from consumable cleanup and skill link since they use
 * a separate actor resolved from roll settings flags.
 * @extends {TwodsixItem}
 */
export class ComponentItem extends TwodsixItem {

  /** @override */
  _getDefaultIcon() {
    return 'systems/twodsix/assets/icons/components/other.svg';
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
      const updates = {};

      // Update default image when using the standard component icon path
      const componentImagePath = "systems/twodsix/assets/icons/components/";
      if (this.img.includes(componentImagePath)) {
        updates.img = componentImagePath + chosenSubtype + ".svg";
      }

      const anComponent = this.system;

      // Prevent cargo or ammo from using %hull weight
      if (anComponent.weightIsPct && ["cargo", "ammo"].includes(chosenSubtype)) {
        foundry.utils.setProperty(data, "system.weightIsPct", false);
      }

      // Unset isBaseHull if not hull component
      if (chosenSubtype !== "hull" && anComponent.isBaseHull) {
        foundry.utils.setProperty(data, "system.isBaseHull", false);
      }

      // Unset hardened if fuel, cargo, ammo, storage, vehicle
      if (["fuel", "cargo", "ammo", "storage", "vehicle"].includes(chosenSubtype)) {
        foundry.utils.setProperty(data, "system.hardened", false);
      }

      // Reset pricing basis for ammo if using hull-based pricing
      if (chosenSubtype === "ammo" && !["perUnit", "perCompTon"].includes(anComponent.pricingBasis)) {
        foundry.utils.setProperty(data, "system.pricingBasis", "perUnit");
      }

      if (!foundry.utils.isEmpty(updates)) {
        foundry.utils.mergeObject(data, updates);
      }
    }

    // Enforce isBaseHull → weightIsPct: false constraint
    if (data.system?.isBaseHull === true && !this.system.isBaseHull) {
      if (this.system.weightIsPct) {
        foundry.utils.setProperty(data, "system.weightIsPct", false);
      }
    }

    return allowed;
  }

  /**
   * Checks if this component is a J-Drive (Jump Drive) based on name and label settings.
   * @override
   * @returns {boolean}
   */
  isJDriveComponent() {
    if (this.system.driveType === "jdrive") {
      return true;
    }
    const componentName = this.name?.toLowerCase() ?? "";
    const jDriveLabel = (game.i18n.localize(game.settings.get('twodsix', 'jDriveLabel'))).toLowerCase();
    return componentName.includes('j-drive') || componentName.includes('j drive') || componentName.includes('jdrive') || componentName.includes(jDriveLabel);
  }

  /**
   * Checks if this component is an M-Drive (Maneuver Drive) based on name and label settings.
   * @override
   * @returns {boolean}
   */
  isMDriveComponent() {
    if (this.system.driveType === "mdrive") {
      return true;
    }
    const componentName = this.name?.toLowerCase() ?? "";
    const mDriveLabel = (game.i18n.localize(game.settings.get('twodsix', 'mDriveLabel'))).toLowerCase();
    return componentName.includes('m-drive') || componentName.includes('m drive') || componentName.includes('mdrive') || componentName.includes(mDriveLabel);
  }
}
