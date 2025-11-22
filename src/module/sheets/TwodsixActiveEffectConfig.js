
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
