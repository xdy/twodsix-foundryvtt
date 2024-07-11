// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * The system-side TwodsixActiveEffect document which overrides/extends the common ActiveEffect model.
 * We extend to our own class to have isSuppressed getter work with equipped status and
 * include a CUSTOM calulation mode directly rather than in a hook
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
}
