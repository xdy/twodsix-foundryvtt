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
              selector: `input[type="text"][name^="${key}.damage"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.OWNING_ACTOR_ROLL_DATA,
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name^="${key}.bonusDamage"]`,
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
              selector: `input[type="text"][name^="initiativeFormula"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: (sheet) =>
                _getTravellerData() ?? _getFallbackActorRollData(sheet.object),
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name^="maxEncumbrance"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: (sheet) =>
                _getTravellerData() ?? _getFallbackActorRollData(sheet.object),
              inlinePrefix: "@"
            },
            {
              selector: `input[type="text"][name^="unarmedDamage"]`,
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.CUSTOM,
              customDataGetter: (sheet) =>
                _getTravellerData() ?? _getFallbackActorRollData(sheet.object),
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

function _getTravellerData(): any {
  const returnObject = duplicate(game.system.template.Actor.traveller);
  for (const char of Object.keys(returnObject.characteristics)) {
    Object.assign(returnObject.characteristics[char], {mod: 0});
  }
  Object.assign(returnObject, {skills: {}});
  return returnObject;
}
