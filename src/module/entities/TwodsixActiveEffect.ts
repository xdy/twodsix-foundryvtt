// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyEncumberedEffect } from "../utils/showStatusIcons";

/**
 * The system-side TwodsixActiveEffect document which overrides/extends the common ActiveEffect model.
 * We extend to our own class to have isSuppressed getter work with equipped status and
 * check for encumbrance when an AE is created or deleted.  CUSTOM mode is still applied as a hook.
 * Each TwodsixActiveEffect belongs to the effects collection of its parent Document.
 * Each TwodsixActiveEffect contains a ActiveEffectData object which provides its source data.
 */
export class TwodsixActiveEffect extends ActiveEffect {
  /**
   * Is there some system logic that makes this active effect ineligible for application?  Accounts for equipped status
   * @type {boolean}
   * @override
   */
  get isSuppressed() {
    if (this.parent instanceof Item) {
      if (["trait"].includes(this.parent.type)) {
        return false;
      } else if (["storage", "junk"].includes(this.parent.type) || this.parent.system.equipped !== 'equipped') {
        return true;
      }
    }
    return false;
  }
  /**
   * Perform follow-up operations after a Document of this type is created.
   * Post-creation operations occur for all clients after the creation is broadcast.
   * @param {object} data               The initial data object provided to the document creation request
   * @param {object} options            Additional options which modify the creation request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onCreate}
   * @protected
   */
  async _onCreate(data, options, userId): void {
    await super._onCreate(data, options, userId);
    if(game.userId === userId  && this.parent?.type === 'traveller') {
      await checkEncumbranceStatus(this);
    }
  }

  /**
   * Perform follow-up operations after a Document of this type is deleted.
   * Post-deletion operations occur for all clients after the deletion is broadcast.
   * @param {object} options            Additional options which modify the deletion request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onDelete}
   * @protected
   */
  async _onDelete(options, userId): void {
    await super._onDelete(options, userId);
    if(game.userId === userId && this.parent?.type === 'traveller') {
      await checkEncumbranceStatus(this);
    }

  }
}

async function checkEncumbranceStatus (activeEffect:TwodsixActiveEffect):void {
  if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators')) {
    if (activeEffect.statuses.size === 0) {
      await applyEncumberedEffect(activeEffect.parent);
    } else {
      const notEncumbered= !activeEffect.statuses.has('encumbered');
      const notWounded = !activeEffect.statuses.has('wounded');
      if (notEncumbered && notWounded) {
        await applyEncumberedEffect(activeEffect.parent);
      }
    }
  }
}
