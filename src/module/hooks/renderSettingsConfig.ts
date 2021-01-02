import {TWODSIX} from "../config";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('renderSettingsConfig', async (app, html, data) => {
  html.find('[name="twodsix.ruleset"]').on('change', ev => {
    const ruleset = ev.target.value;
    const rulesetSettings = TWODSIX.RULESETS[ruleset].setttings;

    // Step through each option and update the corresponding field
    Object.entries(rulesetSettings).forEach(([settingName, value]) => {
      html.find(`[name="twodsix.${settingName}"]`).val(value);
    });
  });
});
