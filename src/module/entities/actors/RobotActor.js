import { CreatureActor } from './CreatureActor.js';

/**
 * Actor document class for robot-type actors.
 * @extends {CreatureActor}
 */
export class RobotActor extends CreatureActor {

  /** @override */
  _getDefaultImage() {
    return 'systems/twodsix/assets/icons/default_robot.svg';
  }

  /** @override */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    if (droppedItem.type === 'skills') {
      return await this._addDroppedSkills(droppedItem);
    } else if (["weapon", "trait", "augment"].includes(droppedItem.type)) {
      return await this._addDroppedEquipment(droppedItem);
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }
}
