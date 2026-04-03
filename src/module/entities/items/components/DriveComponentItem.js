import { BaseComponentItem } from './BaseComponentItem.js';

/**
 * Component subclass for drive subtypes (J-drive, M-drive, etc.).
 * @extends {BaseComponentItem}
 */
export class DriveComponentItem extends BaseComponentItem {

  /** @override */
  isJDriveComponent() {
    if (this.system.driveType === "jdrive") {
      return true;
    }
    const componentName = this.name?.toLowerCase() ?? "";
    const jDriveLabel = (game.i18n.localize(game.settings.get('twodsix', 'jDriveLabel'))).toLowerCase();
    return componentName.includes('j-drive') || componentName.includes('j drive') ||
      componentName.includes('jdrive') || componentName.includes(jDriveLabel);
  }

  /** @override */
  isMDriveComponent() {
    if (this.system.driveType === "mdrive") {
      return true;
    }
    const componentName = this.name?.toLowerCase() ?? "";
    const mDriveLabel = (game.i18n.localize(game.settings.get('twodsix', 'mDriveLabel'))).toLowerCase();
    return componentName.includes('m-drive') || componentName.includes('m drive') ||
      componentName.includes('mdrive') || componentName.includes(mDriveLabel);
  }
}
