import {TWODSIX} from '../config';
import {getGame} from '../utils/utils';

function createWarningDialog(event: Event, message: string) {
  event.preventDefault();
  event.stopPropagation();
  Dialog.confirm({
    title: getGame().i18n.localize('TWODSIX.Settings.hideUntrainedSkills.warning'),
    content: message,
    yes: async () => event.currentTarget ? event.currentTarget['checked'] = !event.currentTarget['checked'] : false,
    defaultYes: true
  });
}

Hooks.on('renderSettingsConfig', async (app, html) => {
  html.find('[name="twodsix.ruleset"]').on('change', ev => {
    const ruleset = ev.target.value;
    const rulesetSettings = TWODSIX.RULESETS[ruleset].settings;

    // Step through each option and update the corresponding field
    Object.entries(rulesetSettings).forEach(([settingName, value]) => {
      console.log(`${ruleset} ${settingName} = ${value}`);
      const setting = html.find(`[name="twodsix.${settingName}"]`);
      if (!setting.is(':checkbox')) {
        setting.val(value);
      } else {
        setting.prop('checked', Boolean(value));
      }
    });
  });

  html.find('[name="twodsix.hideUntrainedSkills"]').on('click', async (event: Event) => {
    const continueText = getGame().i18n.localize('TWODSIX.Settings.hideUntrainedSkills.continue');

    if (getGame().settings.get('twodsix', 'hideUntrainedSkills') && event.currentTarget != null && !event.currentTarget['checked']) {
      const warningResetText = getGame().i18n.localize('TWODSIX.Settings.hideUntrainedSkills.warningReset');
      createWarningDialog(event, `${warningResetText}<br><br>${continueText}<br><br>`);
    } else if (!getGame().settings.get('twodsix', 'hideUntrainedSkills') && event.currentTarget != null && event.currentTarget['checked']) {
      const warningUpdateWeaponText = getGame().i18n.localize('TWODSIX.Settings.hideUntrainedSkills.warningUpdateWeapon');
      createWarningDialog(event, `${warningUpdateWeaponText}<br><br>${continueText}<br><br>`);
    }
  });
});
