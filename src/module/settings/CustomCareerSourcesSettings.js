import { CHARGEN_SUPPORTED_RULESETS } from '../features/chargen/CharGenRegistry';
import AdvancedSettings from './AdvancedSettings';

export default class CustomCareerSourcesSettings extends foundry.applications.api.HandlebarsApplicationMixin(AdvancedSettings) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['twodsix'],
    position: {
      width: 600,
      height: 'auto'
    },
    window: {
      resizable: true,
      contentClasses: ['standard-form'],
      title: 'TWODSIX.Settings.settingsInterface.customCareerSources.name',
      icon: 'fa-solid fa-user-plus'
    },
    form: {
      handler: CustomCareerSourcesSettings.onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    },
    actions: {
      addCompendium: CustomCareerSourcesSettings._addCompendium,
      addFolder: CustomCareerSourcesSettings._addFolder,
      removeRow: CustomCareerSourcesSettings._removeRow
    },
    tag: 'form'
  };
  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/misc/custom-career-sources.hbs',
      scrollable: ['']
    }
  };
  /** @override */
  tabGroups = {
    primary: 'CE'
  };

  constructor(object, options) {
    super(object, {}, options);
    this.rulesetSources = foundry.utils.duplicate(game.settings.get('twodsix', 'customCareerSources'));
    // Ensure all supported rulesets are present
    for (const ruleset of CHARGEN_SUPPORTED_RULESETS) {
      if (!this.rulesetSources[ruleset]) {
        this.rulesetSources[ruleset] = { compendiums: [], folders: [] };
      }
    }
  }

  static create() {
    return CustomCareerSourcesSettings;
  }

  static async onSubmit(event, form, formData) {
    const expanded = foundry.utils.expandObject(formData.object);
    if (expanded.customCareerSources) {
      // Clean up empty entries and ensure they are arrays
      for (const ruleset in expanded.customCareerSources) {
        if (expanded.customCareerSources[ruleset].compendiums) {
          expanded.customCareerSources[ruleset].compendiums = Object.values(expanded.customCareerSources[ruleset].compendiums).filter(v => v);
        } else {
          expanded.customCareerSources[ruleset].compendiums = [];
        }
        if (expanded.customCareerSources[ruleset].folders) {
          expanded.customCareerSources[ruleset].folders = Object.values(expanded.customCareerSources[ruleset].folders).filter(v => v);
        } else {
          expanded.customCareerSources[ruleset].folders = [];
        }
      }
      await game.settings.set('twodsix', 'customCareerSources', expanded.customCareerSources);
    }
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
    this.rulesetSources[ruleset][type].splice(parseInt(index), 1);
    await this.render();
  }

  /** @override */
  getTabs(initialTab) {
    const tabs = {};
    for (const ruleset of CHARGEN_SUPPORTED_RULESETS) {
      tabs[ruleset] = {
        id: ruleset,
        group: 'primary',
        label: ruleset,
        active: initialTab === ruleset,
        cssClass: initialTab === ruleset ? 'active' : ''
      };
    }
    return tabs;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = this.getTabs(this.tabGroups.primary);
    context.rulesetSources = this.rulesetSources;

    context.compendiumOptions = game.packs
      .filter(p => p.metadata.type === 'Item')
      .map(p => ({
        id: p.collection,
        label: `${p.metadata.label} (${p.metadata.packageName})`
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    context.folderOptions = game.folders
      .filter(f => f.type === 'Item')
      .map(f => ({
        id: f.id,
        label: f.name
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
      for (const ruleset in expanded.customCareerSources) {
        if (expanded.customCareerSources[ruleset].compendiums) {
          this.rulesetSources[ruleset].compendiums = Object.values(expanded.customCareerSources[ruleset].compendiums);
        }
        if (expanded.customCareerSources[ruleset].folders) {
          this.rulesetSources[ruleset].folders = Object.values(expanded.customCareerSources[ruleset].folders);
        }
      }
    }
  }
}
