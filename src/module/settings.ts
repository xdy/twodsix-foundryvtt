export const registerSettings = function ():void {
  // Register any custom system settings here
  game.settings.register('twodsix', 'defaultTokenSettings', {
    name: 'Default Prototype Token Settings',
    hint: "Automatically set advised prototype token settings to newly created Actors.",
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
  });

  const DEFAULT_INITIATIVE_FORMULA = "2d6 + @characteristics.dex.mod";
  game.settings.register('twodsix', 'initiativeFormula', {
    name: 'Initiative Formula',
    hint: "Like: \"2d6 + @characteristics.dex.mod\"",
    scope: 'world',
    config: true,
    default: DEFAULT_INITIATIVE_FORMULA,
    onChange: formula => _simpleUpdateInit(formula, true)
  });

  // Retrieve and assign the initiative formula setting.
  const initFormula = game.settings.get("twodsix", "initiativeFormula");
  _simpleUpdateInit(initFormula);

  /**
   * Update the initiative formula.
   * @param {string} formula - Dice formula to evaluate.
   * @param {boolean} notify - Whether or not to post notifications.
   */
  function _simpleUpdateInit(formula:string, notify = false):void {
    let message:string;
    let notificationType:'info' | 'warning' | 'error' = "info";
    const currentFormula = CONFIG.Combat.initiative.formula;
    try {
      new Roll(formula).roll();
      message = `Set initiative formula to: ${formula}`
    } catch (error) {
      if (notify) {
        message = `Failed to set initiative formula to: ${formula}, using previous value ${currentFormula} instead.`
        notificationType = "error";
      }
      game.settings.set("twodsix", "initiativeFormula", currentFormula).then(() => formula = currentFormula);
    }
    CONFIG.Combat.initiative.formula = formula;
    if (notify) {
      ui.notifications.notify(message, notificationType);
    }
  }

  game.settings.register('twodsix', 'modifierForZeroCharacteristic', {
    name: 'Modifier for characteristic value of zero.',
    hint: "Leave empty to use default (-2). Does not automatically recalculate modifiers for existing characters.",
    scope: 'world',
    config: true,
    default: -2,
    type: Number,
  });

  //TODO Tons of settings to come. Skill-list to use, assorted rules that differ between different 2d6 rules sets (CE, CE FTL, etc)

}
