/**
 * Default characteristic row rules when not in point-buy (2d6 random UPP).
 * Lives in a tiny module so {@link CharGenRegistry} and ruleset logic classes can share it
 * without circular imports (registry imports logic; logic must not import registry).
 */
export const DEFAULT_CHARACTERISTICS_UI_RULES = Object.freeze({
  isPointBuy: false,
  inputMin: 1,
  inputMax: 15,
  pointBuyTargetTotal: null,
});
