import { CHARGEN_SUPPORTED_RULESETS } from '../features/chargen/CharGenRegistry.js';
import AdvancedSettings from './AdvancedSettings';
import { booleanSetting, buildUserRoleChoices, stringChoiceSetting } from './settingsUtils';

export default class CharGenSettings extends foundry.applications.api.HandlebarsApplicationMixin(AdvancedSettings) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['twodsix'],
    position: {
      width: 675,
      height: 'auto',
    },
    window: {
      resizable: true,
      contentClasses: ['standard-form'],
      title: 'TWODSIX.Settings.settingsInterface.charGenSettings.name',
      icon: 'fa-solid fa-user-plus',
    },
    form: {
      handler: CharGenSettings.onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false,
    },
    actions: {
      addCompendium: CharGenSettings._addCompendium,
      addFolder: CharGenSettings._addFolder,
      removeRow: CharGenSettings._removeRow,
    },
    tag: 'form',
  };
  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/misc/chargen-settings.hbs',
      scrollable: [''],
    },
  };
  /** @override */
  tabGroups = {
    primary: 'general',
  };

  constructor(object, options) {
    super(object, CharGenSettings.settings, options);
    this.rulesetSources = foundry.utils.duplicate(game.settings.get('twodsix', 'customCareerSources'));
    for (const ruleset of CHARGEN_SUPPORTED_RULESETS) {
      if (!this.rulesetSources[ruleset]) {
        this.rulesetSources[ruleset] = { compendiums: [], folders: [] };
      }
    }
  }

  static create() {
    CharGenSettings.settings = CharGenSettings.registerSettings();
    return CharGenSettings;
  }

  static registerSettings() {
    const roleChoices = buildUserRoleChoices();
    const settings = { general: [] };
    settings.general.push(booleanSetting('chargenSessionJournal', true, false, 'world'));
    settings.general.push(booleanSetting('chargenEnableUndo', true, false, 'world'));
    settings.general.push(stringChoiceSetting(
      'chargenUndoMinRole',
      String(CONST.USER_ROLES.PLAYER),
      false,
      roleChoices,
      false,
      'world',
    ));
    settings.general.push(booleanSetting('chargenEnableRandomRoll', true, false, 'world'));
    settings.general.push(stringChoiceSetting(
      'chargenRandomRollMinRole',
      String(CONST.USER_ROLES.PLAYER),
      false,
      roleChoices,
      false,
      'world',
    ));
    for (const ruleset of CHARGEN_SUPPORTED_RULESETS) {
      settings[ruleset] = [];
    }
    return settings;
  }

  static async onSubmit(event, form, formData) {
    if (event.type !== 'submit') {
      return;
    }
    const expanded = foundry.utils.expandObject(formData.object);
    if (expanded.customCareerSources) {
      expanded.customCareerSources = CharGenSettings._normalizeCustomCareerSources(expanded.customCareerSources);
      await game.settings.set('twodsix', 'customCareerSources', expanded.customCareerSources);
    }
    await AdvancedSettings.persistRegisteredTwodsixSettings(expanded, ['customCareerSources']);
  }

  static _normalizeCustomCareerSources(sources) {
    const normalized = {};
    for (const [ruleset, entry] of Object.entries(sources)) {
      normalized[ruleset] = {
        compendiums: entry.compendiums
          ? Object.values(entry.compendiums).filter(v => v)
          : [],
        folders: entry.folders
          ? Object.values(entry.folders).filter(v => v)
          : [],
      };
    }
    return normalized;
  }

  static async _addCompendium(event, target) {
    const ruleset = target.dataset.ruleset;
    this._updateFromForm();
    this.rulesetSources[ruleset].compendiums.push('');
    await this.render();
  }

  static async _addFolder(event, target) {
    const ruleset = target.dataset.ruleset;
    this._updateFromForm();
    this.rulesetSources[ruleset].folders.push('');
    await this.render();
  }

  static async _removeRow(event, target) {
    const { ruleset, type, index } = target.dataset;
    this._updateFromForm();
    this.rulesetSources[ruleset][type].splice(parseInt(index, 10), 1);
    await this.render();
  }

  /**
   * @param {object} settings
   * @param {string} initialTab
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  getTabs(settings, initialTab) {
    const tabs = {};
    for (const key of Object.keys(settings)) {
      const isGeneral = key === 'general';
      const rs = CONFIG.TWODSIX?.RULESETS?.[key];
      tabs[key] = {
        id: key,
        group: 'primary',
        icon: isGeneral ? 'fa-solid fa-gear' : 'fa-solid fa-briefcase',
        label: isGeneral ? 'TWODSIX.Settings.menuLabels.general' : undefined,
        rawLabel: isGeneral ? undefined : (rs?.name || key),
        active: initialTab === key,
        cssClass: initialTab === key ? 'active' : '',
      };
    }
    return tabs;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = this.getTabs(CharGenSettings.settings, this.tabGroups.primary);
    context.rulesetSources = this.rulesetSources;
    context.intro = `<h2>${game.i18n.localize('TWODSIX.Settings.settingsInterface.charGenSettings.intro')}</h2>`;

    context.compendiumOptions = game.packs
      .filter(p => p.metadata.type === 'Item')
      .map(p => ({
        id: p.collection,
        label: `${p.metadata.label} (${p.metadata.packageName})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    context.folderOptions = game.folders
      .filter(f => f.type === 'Item')
      .map(f => ({
        id: f.id,
        label: f.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return context;
  }

  _updateFromForm() {
    const form = this.form;
    if (!form) {
      return;
    }
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const expanded = foundry.utils.expandObject(formData.object);
    if (expanded.customCareerSources) {
      const normalized = CharGenSettings._normalizeCustomCareerSources(expanded.customCareerSources);
      for (const [ruleset, value] of Object.entries(normalized)) {
        this.rulesetSources[ruleset] = value;
      }
    }
  }
}
