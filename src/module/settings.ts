export const registerSettings = function ():void {

  // Register any custom system settings here
  game.settings.register('twodsix', 'defaultTokenSettings', {
    name: game.i18n.localize("TWODSIX.Settings.defaultTokenSettings.name"),
    hint: game.i18n.localize("TWODSIX.Settings.defaultTokenSettings.hint"),
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
  });

  const DEFAULT_INITIATIVE_FORMULA = "2d6 + @characteristics.dexterity.mod";
  game.settings.register('twodsix', 'initiativeFormula', {
    name: game.i18n.localize("TWODSIX.Settings.initiativeFormula.name"),
    hint: game.i18n.localize("TWODSIX.Settings.initiativeFormula.hint"),
    scope: 'world',
    config: true,
    default: DEFAULT_INITIATIVE_FORMULA,
    onChange: formula => _simpleUpdateInit(formula, true)
  });

  // Retrieve and assign the initiative formula setting. Not sure it should be here.
  const initFormula = game.settings.get("twodsix", "initiativeFormula");
  _simpleUpdateInit(initFormula);

  game.settings.register('twodsix', 'modifierForZeroCharacteristic', {
    name: game.i18n.localize("TWODSIX.Settings.modifierForZeroCharacteristic.name"),
    hint: game.i18n.localize("TWODSIX.Settings.modifierForZeroCharacteristic.hint"),
    scope: 'world',
    config: true,
    default: -2,
    type: Number,
  });

  game.settings.register('twodsix', 'maxSkillLevel', {
    name: game.i18n.localize("TWODSIX.Settings.maxSkillLevel.name"),
    hint: game.i18n.localize("TWODSIX.Settings.maxSkillLevel.hint"),
    scope: 'world',
    config: true,
    default: 9,
    type: Number,
  });


  game.settings.register('twodsix', 'termForAdvantage', {
    name: game.i18n.localize("TWODSIX.Settings.termForAdvantage.name"),
    hint: game.i18n.localize("TWODSIX.Settings.termForAdvantage.hint"),
    scope: 'world',
    config: true,
    default: 'advantage',
  });

  game.settings.register('twodsix', 'termForDisadvantage', {
    name: game.i18n.localize("TWODSIX.Settings.termForDisadvantage.name"),
    hint: game.i18n.localize("TWODSIX.Settings.termForDisadvantage.hint"),
    scope: 'world',
    config: true,
    default: 'disadvantage',
  });

  game.settings.register('twodsix', 'effectOrTotal', {
    name: game.i18n.localize("TWODSIX.Settings.effectOrTotal.name"),
    hint: game.i18n.localize("TWODSIX.Settings.effectOrTotal.name"),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register('twodsix', 'automateDamageRollOnHit', {
    name: game.i18n.localize("TWODSIX.Settings.automateDamageRollOnHit.name"),
    hint: game.i18n.localize("TWODSIX.Settings.automateDamageRollOnHit.name"),
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
  });

  game.settings.register('twodsix', 'absoluteBonusValueForEachTimeIncrement', {
    name: game.i18n.localize("TWODSIX.Settings.absoluteBonusValueForEachTimeIncrement.name"),
    hint: game.i18n.localize("TWODSIX.Settings.absoluteBonusValueForEachTimeIncrement.hint"),
    scope: 'world',
    config: true,
    default: -1,
    type: Number,
  });

  //Must be the last setting in the file
  game.settings.register('twodsix', 'systemMigrationVersion', {
    name: game.i18n.localize("TWODSIX.Settings.systemMigrationVersion.name"),
    hint: game.i18n.localize("TWODSIX.Settings.systemMigrationVersion.hint"),
    scope: 'world',
    config: true,
    default: game.system.data.version,
    type: String,
  });

};

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
    message = `Set initiative formula to: ${formula}`;
  } catch (error) {
    if (notify) {
      message = `Failed to set initiative formula to: ${formula}, using previous value ${currentFormula} instead.`;
      notificationType = "error";
    }
    game.settings.set("twodsix", "initiativeFormula", currentFormula).then(() => formula = currentFormula);
  }
  CONFIG.Combat.initiative = {
    formula: formula,
    decimals: 0
  };
  if (notify) {
    ui.notifications.notify(message, notificationType);
  }
}

export function advantageDisadvantageTerm(rollType:string):string {
  switch (rollType.toLowerCase()) {
    case "advantage":
      return game.settings.get('twodsix', 'termForAdvantage');
    case "disadvantage":
      return game.settings.get('twodsix', 'termForDisadvantage');
    default:
      return rollType;
  }
}

