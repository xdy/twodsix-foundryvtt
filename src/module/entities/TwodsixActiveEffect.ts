// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

export class TwodsixActiveEffect extends ActiveEffect {
  /** @override */
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
