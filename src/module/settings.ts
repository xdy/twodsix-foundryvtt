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

  // Retrieve and assign the initiative formula setting. Not sure it should be here.
  const initFormula = game.settings.get("twodsix", "initiativeFormula");
  _simpleUpdateInit(initFormula);

  game.settings.register('twodsix', 'modifierForZeroCharacteristic', {
    name: 'Modifier for characteristic value of zero.',
    hint: "Leave empty to use default (-2). Does not automatically recalculate modifiers for existing characters.",
    scope: 'world',
    config: true,
    default: -2,
    type: Number,
  });

  game.settings.register('twodsix', 'maxSkillLevel', {
    name: 'Maximum skill level.',
    hint: "Leave empty to use default (9).",
    scope: 'world',
    config: true,
    default: 9,
    type: Number,
  });


  game.settings.register('twodsix', 'termForAdvantage', {
    name: 'What you want to call rolls with advantage (3d6kh2).',
    hint: "Don't use the same word as for termForDisadvantage...",
    scope: 'world',
    config: true,
    default: 'advantage',
  });

  game.settings.register('twodsix', 'termForDisadvantage', {
    name: 'What you want to call rolls with disadvantage (3d6kl2).',
    hint: "Don't use the same word as for termForAdvantage...",
    scope: 'world',
    config: true,
    default: 'disadvantage',
  });

  game.settings.register('twodsix', 'effectOrTotal', {
    name: 'Show effect or total roll value for skill and characteristic rolls.',
    hint: "true=Show effect (i.e. roll+modifiers-target number, usually 8), false=show total (i.e. roll+modifiers)",
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
  });

  game.settings.register('twodsix', 'absoluteBonusValueForEachTimeIncrement', {
    name: 'What bonus/penalty to give per each time increment change in a task.',
    hint: "Leave empty to use default (+/-1). Not currently used.",
    scope: 'world',
    config: true,
    default: -1,
    type: Number,
  });

  //Must be the last setting in the file
  game.settings.register('twodsix', 'systemMigrationVersion', {
    name: 'System Schema Version',
    hint: "Records the schema version for the Twodsix system. (Don't modify this unless you know what you are doing)",
    scope: 'world',
    config: true,
    default: 0,
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
  CONFIG.Combat.initiative.formula = formula;
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

