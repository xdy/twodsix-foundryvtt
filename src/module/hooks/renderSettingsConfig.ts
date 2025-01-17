// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

async function createWarningDialog(event, message: string) {
  event.preventDefault();
  event.stopPropagation();
  const currentTarget = event.currentTarget;
  if (currentTarget) {
    if (await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warning")},
      content: message
    })) {
      currentTarget["checked"] = !currentTarget["checked"];
    }
  }
}

Hooks.on('updateSetting', async (setting) => {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  if (Object.keys(TWODSIX.RULESETS[ruleset].settings).includes(setting.key.slice(8))) {
    if (game.settings.sheet.rendered) {
      game.settings.sheet.render({force: true});
    }
  }
});

Hooks.on('renderAdvancedSettings', async (app, htmlElement) => {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;
  Object.entries(rulesetSettings).forEach(([settingName, value]) => {
    let el = htmlElement.querySelector(`[name="${settingName}"]`);
    if (el) {
      const isChanged = game.settings.get("twodsix", settingName) !== value;
      if (el.type === "checkbox") {
        el = el.parentNode;
      }
      el.style.border = isChanged ? "1px solid orange" : "1px solid green";
    }
  });
});

Hooks.on('renderSettingsConfig', async (app, html:JQuery|HTMLElement) => {
  const htmlElement:HTMLElement = (html instanceof jQuery) ? html.get(0) : html; //Maybe not required when v13 fully Appv2
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;
  const settings = Object.entries(rulesetSettings).map(([settingName, value]) => {
    return game.settings.get("twodsix", settingName) === value;
  });
  if (!settings.every(v => v)) {
    const modified = game.i18n.localize("TWODSIX.Settings.settingsInterface.rulesetSettings.modified");
    const selectedRuleset = htmlElement.querySelector(`[name="twodsix.ruleset"] option[value="${ruleset}"]`);
    selectedRuleset.textContent = `${TWODSIX.RULESETS[ruleset].name} (${modified})`;
    selectedRuleset.classList.add("modified-ruleset");
    const newOption = document.createElement('option');
    newOption.value = `${ruleset}`;
    newOption.text = `${TWODSIX.RULESETS[ruleset].name}`;
    selectedRuleset.after(newOption);
  }

  htmlElement.querySelector('[name="twodsix.ruleset"]')?.addEventListener('change', async ev => {
    if (await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("TWODSIX.Dialogs.rulesetChange.title")},
      content: game.i18n.localize("TWODSIX.Dialogs.rulesetChange.content")
    })) {
      const newRuleset = ev.target.value;
      const newRulesetSettings = TWODSIX.RULESETS[newRuleset].settings;
      await game.settings.set("twodsix", "ruleset", newRuleset);
      // Step through each option and update the corresponding field
      Object.entries(newRulesetSettings).forEach(([settingName, value]) => {
        game.settings.set("twodsix", settingName, value);
        console.log(`${newRuleset} ${settingName} = ${value}`);
      });
    }
  });

  htmlElement.querySelector('[name="twodsix.hideUntrainedSkills"]')?.addEventListener('click', async (event) => {
    const continueText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.continue");

    const currentTarget = event.currentTarget;
    if (currentTarget) {
      if (game.settings.get('twodsix', 'hideUntrainedSkills') && !currentTarget["checked"]) {
        const warningResetText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warningReset");
        createWarningDialog(event, `${warningResetText}<br>${continueText}<br>`);
      } else if (!game.settings.get('twodsix', 'hideUntrainedSkills') && currentTarget["checked"]) {
        const warningUpdateWeaponText = game.i18n.localize("TWODSIX.Settings.hideUntrainedSkills.warningUpdateWeapon");
        createWarningDialog(event, `${warningUpdateWeaponText}<br>${continueText}<br>`);
      }
    }
  });
});
