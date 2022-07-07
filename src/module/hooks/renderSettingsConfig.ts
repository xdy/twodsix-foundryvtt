import { TWODSIX } from "../config";

function createWarningDialog(event, message: string) {
  event.preventDefault();
  event.stopPropagation();
  const currentTarget = event.currentTarget;
  if (currentTarget) {
    Dialog.confirm({
      title: game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warning"),
      content: message,
      yes: async () => currentTarget["checked"] = !currentTarget["checked"],
      defaultYes: true
    });
  }
}

Hooks.on('updateSetting', async (setting) => {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  if (Object.keys(TWODSIX.RULESETS[ruleset].settings).includes(setting.key.slice(8))) {
    game.settings.sheet.render();
  }
});

Hooks.on('renderAdvancedSettings', async (app, html) => {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;
  Object.entries(rulesetSettings).forEach(([settingName, value]) => {
    const el = html.find(`[name="${settingName}"]`);
    if (game.settings.get("twodsix", settingName) !== value) {
      el.filter(`:not([type="checkbox"])`).css("border", "1px solid orange");
      el.filter(`[type="checkbox"]`).parent().css("border", "1px solid orange");
    } else {
      el.filter(`:not([type="checkbox"])`).css("border", "1px solid green");
      el.filter(`[type="checkbox"]`).parent().css("border", "1px solid green");
    }
  });
});

Hooks.on('renderSettingsConfig', async (app, html) => {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;
  const settings = Object.entries(rulesetSettings).map(([settingName, value]) => {
    return game.settings.get("twodsix", settingName) === value;
  });
  if (!settings.every(v => v)) {
    const modified = game.i18n.localize("TWODSIX.Settings.settingsInterface.rulesetSettings.modified");
    html.find(`[name="twodsix.ruleset"] option[value="${ruleset}"]`).text(`${TWODSIX.RULESETS[ruleset].name} (${modified})`).addClass("modified-ruleset");
    html.find(`[name="twodsix.ruleset"] .modified-ruleset`).after(`<option value="${ruleset}">${TWODSIX.RULESETS[ruleset].name}</option>`);
  }

  html.find('[name="twodsix.ruleset"]').on('change', async ev => {
    if (await Dialog.confirm({
      title: "Change ruleset",
      content: "Do you want to change ruleset? If you have custom options they will be erased. This step cannot be undone."
    })) {
      const newRuleset = ev.target.value;
      const newRulesetSettings = TWODSIX.RULESETS[newRuleset].settings;
      game.settings.set("twodsix", "ruleset", newRuleset); //TODO Should have await?
      // Step through each option and update the corresponding field
      Object.entries(newRulesetSettings).forEach(([settingName, value]) => {
        game.settings.set("twodsix", settingName, value);
        console.log(`${newRuleset} ${settingName} = ${value}`);
      });
    }
  });

  html.find('[name="twodsix.hideUntrainedSkills"]').on('click', async (event) => {
    const continueText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.continue");

    const currentTarget = event.currentTarget;
    if (currentTarget) {
      if (game.settings.get('twodsix', 'hideUntrainedSkills') && !currentTarget["checked"]) {
        const warningResetText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warningReset");
        createWarningDialog(event, `${warningResetText}<br><br>${continueText}<br><br>`);
      } else if (!game.settings.get('twodsix', 'hideUntrainedSkills') && currentTarget["checked"]) {
        const warningUpdateWeaponText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warningUpdateWeapon");
        createWarningDialog(event, `${warningUpdateWeaponText}<br><br>${continueText}<br><br>`);
      }
    }
  });
});
