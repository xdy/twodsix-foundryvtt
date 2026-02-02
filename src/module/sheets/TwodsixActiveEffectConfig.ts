// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * A small subclass of the Foundry ActiveEffectConfig which makes the window resizable.
 */
export class TwodsixActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    foundry.applications.sheets.ActiveEffectConfig.DEFAULT_OPTIONS,
    {
      window: {
        resizable: true
      }
    },
    {inplace: false}
  );
}
