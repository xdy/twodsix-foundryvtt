import {TWODSIX} from "../config";

function createWarningDialog(event:Event, message:string) {
  event.preventDefault();
  event.stopPropagation();
  // @ts-ignore
  Dialog.confirm({
    title: game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warning"),
    content: message,
    yes: async () => event.currentTarget["checked"] = !event.currentTarget["checked"],
    no: null,
    defaultYes: true
  });
}

Hooks.on('renderSettingsConfig', async (app, html) => {
  html.find('[name="twodsix.ruleset"]').on('change', async ev => {
    if (await Dialog.confirm({title: "Change ruleset", content: "Do you want to change ruleset? If you have custom options they will be erased. This step cannot be undone."})) {
      const ruleset = ev.target.value;
      const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;
      game.settings.set("twodsix", "ruleset", ruleset);
      if (ruleset !== "OTHER") {
        // Step through each option and update the corresponding field
        Object.entries(rulesetSettings).forEach(([settingName, value]) => {
          game.settings.set("twodsix", settingName, value);
          console.log(`${ruleset} ${settingName} = ${value}`);
        });
      }
    }
  });

  html.find('[name="twodsix.hideUntrainedSkills"]').on('click', async (event:Event) => {
    const continueText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.continue");

    if (game.settings.get('twodsix', 'hideUntrainedSkills') && !event.currentTarget["checked"]) {
      const warningResetText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warningReset");
      createWarningDialog(event, `${warningResetText}<br><br>${continueText}<br><br>`);
    } else if (!game.settings.get('twodsix', 'hideUntrainedSkills') && event.currentTarget["checked"]) {
      const warningUpdateWeaponText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warningUpdateWeapon");
      createWarningDialog(event, `${warningUpdateWeaponText}<br><br>${continueText}<br><br>`);
    }
  });
});
