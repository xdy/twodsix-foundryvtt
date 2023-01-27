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
              defaulpath: "system",
              showButton: true,
              allowHotkey: true,
              dataMode: DATA_MODE.OWNING_ACTOR_DATA,
            }
          ]
        },
        // Add more sheet classes if necessary
      ]
    };

    // Add our config
    packageConfig.push(config);
  }
});
