import {
  customTraderPresetSettingValue,
  findMatchingTraderPreset,
  getBuiltInTraderPresetChoices,
  getCurrentTraderSourceMap,
  getCustomPresetId,
  getCustomTraderPresetChoices,
  getCustomTraderPresetStore,
  getTraderPresetChoices,
  getTraderPresetSourceMap,
  getTraderRulesetSourceChoices,
  normalizeTraderSourceMap,
  setCustomTraderPresetStore,
  slugifyTraderPresetName,
  TRADER_CUSTOM_PRESETS_VERSION,
  TRADER_OTHER_RULESET,
  TRADER_RULESET_SELECTOR_METHODS,
  TRADER_RULESET_SELECTORS,
  traderRulesetSourceSettingKey,
} from '../features/trader/TraderRulesetRegistry.js';
import AdvancedSettings from './AdvancedSettings';
import { booleanSetting, buildUserRoleChoices, stringChoiceSetting } from './settingsUtils';

/** Default built-in trader preset key. */
const TRADER_DEFAULT_PRESET = 'CE';

export default class TraderSettings extends foundry.applications.api.HandlebarsApplicationMixin(AdvancedSettings) {
  static _applyingPreset = false;
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['twodsix'],
    position: {
      width: 675,
      height: 'auto'
    },
    window: {
      resizable: true,
      contentClasses: ['standard-form'],
      title: 'TWODSIX.Settings.settingsInterface.traderSettings.name',
      icon: 'fa-solid fa-scale-balanced'
    },
    form: {
      handler: TraderSettings.onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    },
    actions: {
      copyFromPreset: TraderSettings._copyFromPreset,
      savePreset: TraderSettings._savePreset,
      deletePreset: TraderSettings._deletePreset,
    },
    tag: 'form'
  };
  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/misc/trader-settings.hbs',
      scrollable: ['']
    }
  };
  /** @override */
  tabGroups = {
    primary: 'general'
  };

  constructor(object, options) {
    super(object, TraderSettings.settings, options);
  }

  static create() {
    TraderSettings.settings = TraderSettings.registerSettings();
    return TraderSettings;
  }

  static registerSettings() {
    const settings = {
      general: [],
      search: [],
      broker: [],
      events: [],
    };
    settings.general.push(stringChoiceSetting(
      'traderRuleset',
      TRADER_DEFAULT_PRESET,
      true,
      getTraderPresetChoices(),
      false,
      'world',
      TraderSettings._onTraderRulesetChange
    ));

    const roleChoices = buildUserRoleChoices();
    settings.general.push(booleanSetting('traderEnableUndo', false, false, 'world'));
    settings.general.push(stringChoiceSetting(
      'traderUndoMinRole',
      String(CONST.USER_ROLES.PLAYER),
      false,
      roleChoices,
      false,
      'world',
    ));
    settings.general.push(booleanSetting('traderEnableRandomRoll', false, false, 'world'));
    settings.general.push(stringChoiceSetting(
      'traderRandomRollMinRole',
      String(CONST.USER_ROLES.PLAYER),
      false,
      roleChoices,
      false,
      'world',
    ));

    const sourceChoices = getTraderRulesetSourceChoices();
    for (const selector of TRADER_RULESET_SELECTORS) {
      settings[selector.group].push(stringChoiceSetting(
        traderRulesetSourceSettingKey(selector.method),
        'CE',
        true,
        sourceChoices,
        false,
        'world',
        TraderSettings._onSourceSettingChange
      ));
    }

    return settings;
  }

  static refreshDynamicChoices() {
    const traderRulesetSetting = game.settings.settings.get('twodsix.traderRuleset');
    if (traderRulesetSetting) {
      traderRulesetSetting.choices = getTraderPresetChoices();
    }
    const sourceChoices = getTraderRulesetSourceChoices();
    for (const method of TRADER_RULESET_SELECTOR_METHODS) {
      const sourceSetting = game.settings.settings.get(`twodsix.${traderRulesetSourceSettingKey(method)}`);
      if (sourceSetting) {
        sourceSetting.choices = sourceChoices;
      }
    }
  }

  static async onSubmit(event, form, formData) {
    if (event.type !== 'submit') {
      return;
    }

    const expanded = foundry.utils.expandObject(formData.object);
    const selectedRuleset = expanded.traderRuleset || TRADER_OTHER_RULESET;

    if (selectedRuleset !== TRADER_OTHER_RULESET) {
      const sourceMap = getTraderPresetSourceMap(selectedRuleset);
      if (sourceMap) {
        await TraderSettings.applySourceMap(sourceMap, selectedRuleset);
      } else {
        const sourceMapFromForm = TraderSettings._sourceMapFromExpandedForm(expanded);
        await TraderSettings.applySourceMap(
          sourceMapFromForm,
          findMatchingTraderPreset(sourceMapFromForm) || TRADER_OTHER_RULESET,
        );
      }
    } else {
      const sourceMap = TraderSettings._sourceMapFromExpandedForm(expanded);
      await TraderSettings.applySourceMap(sourceMap, findMatchingTraderPreset(sourceMap) || TRADER_OTHER_RULESET);
    }

    await AdvancedSettings.persistRegisteredTwodsixSettings(expanded);
  }

  static async _onTraderRulesetChange(value) {
    if (TraderSettings._applyingPreset || value === TRADER_OTHER_RULESET) {
      return;
    }

    const sourceMap = getTraderPresetSourceMap(value);
    if (sourceMap) {
      await TraderSettings.applySourceMap(sourceMap, value);
    }
  }

  static async _onSourceSettingChange() {
    if (TraderSettings._applyingPreset) {
      return;
    }

    const matchingPreset = findMatchingTraderPreset(getCurrentTraderSourceMap());
    await game.settings.set('twodsix', 'traderRuleset', matchingPreset || TRADER_OTHER_RULESET);
  }

  static async applySourceMap(sourceMap, activeRuleset = TRADER_OTHER_RULESET) {
    TraderSettings._applyingPreset = true;
    try {
      const normalizedSourceMap = normalizeTraderSourceMap(sourceMap);
      for (const method of TRADER_RULESET_SELECTOR_METHODS) {
        await game.settings.set('twodsix', traderRulesetSourceSettingKey(method), normalizedSourceMap[method]);
      }
      await game.settings.set('twodsix', 'traderRuleset', activeRuleset);
    } finally {
      TraderSettings._applyingPreset = false;
    }
  }

  static async _copyFromPreset(event, target) {
    const presetKey = target.form?.querySelector('[name="copyFromTraderPreset"]')?.value;
    const sourceMap = getTraderPresetSourceMap(presetKey);
    if (!sourceMap) {
      ui.notifications.warn(game.i18n.localize('TWODSIX.Settings.traderCustomPresets.copyMissing'));
      return;
    }

    await TraderSettings.applySourceMap(sourceMap, TRADER_OTHER_RULESET);
    await this.render({ force: true });
  }

  static async _savePreset(event, target) {
    const form = target.form;
    const name = form?.querySelector('[name="traderCustomPresetName"]')?.value?.trim();
    if (!name) {
      ui.notifications.warn(game.i18n.localize('TWODSIX.Settings.traderCustomPresets.nameRequired'));
      return;
    }

    const sourceMap = TraderSettings._sourceMapFromForm(form);
    const store = getCustomTraderPresetStore();
    const activeCustomId = getCustomPresetId(game.settings.get('twodsix', 'traderRuleset'));
    const id = activeCustomId || TraderSettings._uniquePresetId(name, store.presets);
    store.presets[id] = {
      name,
      selectors: normalizeTraderSourceMap(sourceMap),
    };

    await setCustomTraderPresetStore({
      version: TRADER_CUSTOM_PRESETS_VERSION,
      presets: store.presets,
    });
    const settingValue = customTraderPresetSettingValue(id);
    TraderSettings.refreshDynamicChoices();
    await TraderSettings.applySourceMap(store.presets[id].selectors, settingValue);
    ui.notifications.info(game.i18n.format('TWODSIX.Settings.traderCustomPresets.saved', { name }));
    await this.render({ force: true });
  }

  static async _deletePreset(event, target) {
    const customPresetId = getCustomPresetId(game.settings.get('twodsix', 'traderRuleset'));
    if (!customPresetId) {
      return;
    }

    const store = getCustomTraderPresetStore();
    const name = store.presets[customPresetId]?.name || customPresetId;
    delete store.presets[customPresetId];
    await setCustomTraderPresetStore({
      version: TRADER_CUSTOM_PRESETS_VERSION,
      presets: store.presets,
    });
    TraderSettings.refreshDynamicChoices();
    await game.settings.set('twodsix', 'traderRuleset', TRADER_OTHER_RULESET);
    ui.notifications.info(game.i18n.format('TWODSIX.Settings.traderCustomPresets.deleted', { name }));
    await this.render({ force: true });
  }

  static _sourceMapFromForm(form) {
    if (!form) {
      return getCurrentTraderSourceMap();
    }

    const formData = new foundry.applications.ux.FormDataExtended(form);
    const expanded = foundry.utils.expandObject(formData.object);
    return TraderSettings._sourceMapFromExpandedForm(expanded);
  }

  static _sourceMapFromExpandedForm(expanded) {
    return normalizeTraderSourceMap(Object.fromEntries(TRADER_RULESET_SELECTOR_METHODS.map(method => {
      return [method, expanded[traderRulesetSourceSettingKey(method)]];
    })));
  }

  static _uniquePresetId(name, presets) {
    const slug = slugifyTraderPresetName(name);
    let id = slug;
    let index = 2;
    while (presets[id]) {
      id = `${slug}-${index}`;
      index += 1;
    }
    return id;
  }

  static _presetLabel(presetKey) {
    const choices = getTraderPresetChoices();
    const label = choices[presetKey] || choices[TRADER_DEFAULT_PRESET] || TRADER_DEFAULT_PRESET;
    return String(label).startsWith('TWODSIX.') ? game.i18n.localize(label) : label;
  }

  /** @override */
  async _prepareContext(options) {
    TraderSettings.refreshDynamicChoices();
    const context = await super._prepareContext(options);
    const activeRuleset = game.settings.get('twodsix', 'traderRuleset');
    const activeSourceMap = getCurrentTraderSourceMap();
    const matchingPreset = findMatchingTraderPreset(activeSourceMap);
    const activeLabel = TraderSettings._presetLabel(activeRuleset);
    const modified = game.i18n.localize('TWODSIX.Settings.settingsInterface.traderSettings.modified');
    const showModified = activeRuleset !== TRADER_OTHER_RULESET && matchingPreset !== activeRuleset;

    context.intro = `<h2>${game.i18n.localize('TWODSIX.Settings.settingsInterface.traderSettings.intro')}: ${activeLabel}${showModified ? ` (${modified})` : ''}</h2>`;
    context.tabs = this.getTabs(TraderSettings.settings, this.tabGroups.primary);
    context.customPresetControls = this._prepareCustomPresetControls(activeRuleset);
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelectorAll('[name^="traderRulesetSource"]').forEach(select => {
      select.addEventListener('change', () => {
        const rulesetSelect = this.element.querySelector('[name="traderRuleset"]');
        if (rulesetSelect) {
          rulesetSelect.value = TRADER_OTHER_RULESET;
        }
      });
    });
  }

  _prepareCustomPresetControls(activeRuleset) {
    const copyChoices = {
      ...getBuiltInTraderPresetChoices(),
      ...getCustomTraderPresetChoices(),
    };
    const activeCustomId = getCustomPresetId(activeRuleset);
    const activeCustomPreset = activeCustomId ? getCustomTraderPresetStore().presets[activeCustomId] : null;
    return {
      isOther: activeRuleset === TRADER_OTHER_RULESET,
      copyChoices,
      name: activeCustomPreset?.name || '',
      canDelete: !!activeCustomPreset,
    };
  }
}
