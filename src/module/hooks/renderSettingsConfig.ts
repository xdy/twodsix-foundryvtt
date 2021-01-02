import {TWODSIX} from "../config";

Hooks.on('renderSettingsConfig', async (app, html) => {
  html.find('[name="twodsix.ruleset"]').on('change', ev => {
    const ruleset = ev.target.value;
    const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;

    // Step through each option and update the corresponding field
    Object.entries(rulesetSettings).forEach(([settingName, value]) => {
      html.find(`[name="twodsix.${settingName}"]`).val(value);
    });
  });
});
