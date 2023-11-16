// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("aipSetup", (packageConfig) => {
  const api = game.modules.get("autocomplete-inline-properties")?.API;
  if (api) {
    const DATA_MODE = api.CONST.DATA_MODE;

    // Define the config for our package
    const config = {
      packageName: "twodsix",
      sheetClasses: [
        {
          name: "ActiveEffectConfig",
          fieldConfigs: [
            {
              selector: `.tab[data-tab="effects"] .key input[type="text"]`,
              defaultpath: "system",
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.OWNING_ACTOR_DATA,
            }
          ]
        },
        {
          name: "TwodsixItemSheet",
          fieldConfigs: ["system"].flatMap((key) => [
            {
              selector: `input[type="text"][name="${key}.damage"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.OWNING_ACTOR_ROLL_DATA,
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name="${key}.bonusDamage"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.OWNING_ACTOR_ROLL_DATA,
              inlinePrefix: "@"
            }
          ]),
        },
        {
          name: "AdvancedSettings",
          fieldConfigs: [
            {
              selector: `input[type="text"][name="initiativeFormula"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: () =>
                _getTravellerData(),
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name="shipInitiativeFormula"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: () =>
                _getShipData(),
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name="maxEncumbrance"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: () =>
                _getTravellerData(),
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name="unarmedDamage"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: () =>
                _getTravellerData(),
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name="armorDamageFormula"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: () =>
                _getArmorData(),
              inlinePrefix: "@"
            }
          ]
        }
        // Add more sheet classes if necessary
      ]
    };

    // Add our config
    packageConfig.push(config);
  }
});

/**
 * Returns the Traveller data template with .characteristics[X].mod and .skills added
 * @returns {any} An object of the traveller actor template
 * @private
 */
function _getTravellerData(): any {
  const returnObject = duplicate(game.system.template.Actor.traveller);
  Object.assign(returnObject, {characteristics: {}});
  for (const char of Object.keys(game.system.template.Actor.templates.characteristicsTemplate.characteristics)) {
    Object.assign(returnObject.characteristics, {[char]: {mod: 0}});
  }
  Object.assign(returnObject, {skills: {}});
  return returnObject;
}
/**
 * Returns the Ship data template
 * @returns {any}    An object of the ship actor template
 * @private
 */
function _getShipData(): any {
  const returnObject = duplicate(game.system.template.Actor.ship);
  return returnObject;
}
/**
 * Returns the Traveller data template with .characteristics[X].mod, .skills and .damage and .effectiveArmor added
 * @returns {any} An object of the traveller actor template
 * @private
 */
function _getArmorData(): any {
  const returnObject = _getTravellerData();
  Object.assign(returnObject, {damage: "", effectiveArmor: ""});
  return returnObject;
}
