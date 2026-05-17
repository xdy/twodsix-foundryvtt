import { applyToAllActors, applyToAllItems } from '../utils/migration-utils';
import AdvancedSettings from './AdvancedSettings';
import { refreshWindow } from './DisplaySettings';
import { booleanSetting, stringSetting } from './settingsUtils';

export default class DebugSettings extends foundry.applications.api.HandlebarsApplicationMixin(AdvancedSettings) {
  /** @override */
  static DEFAULT_OPTIONS =  {
    classes: ["twodsix"],
    position: {
      width: 675,
      height: 'auto'
    },
    window: {
      resizable: true,
      contentClasses: ["standard-form"],
      title: "TWODSIX.Settings.settingsInterface.debugSettings.name",
      icon: "fa-solid fa-flask"
    },
    form: {
      handler: AdvancedSettings.onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    },
    tag: "form"
  };
  static PARTS = {
    main: {
      template: "systems/twodsix/templates/misc/advanced-settings.hbs",
      scrollable: ['']
    }
  };
  /** @override */
  tabGroups = {
    primary: "general"  //set default tab
  };

  constructor(object, options) {
    super(object, DebugSettings.settings, options);
  }

  static create() {
    DebugSettings.settings = DebugSettings.registerSettings();
    return DebugSettings;
  }

  static registerSettings() {
    const settings = {
      general: [],
      style: [],
      dragDrop: []
    };
    settings.general.push(booleanSetting('ExperimentalFeatures', false));
    settings.general.push(stringSetting('systemMigrationVersion', ""));
    settings.style.push(booleanSetting('useModuleFixStyle', false, false, 'world', refreshWindow));
    settings.general.push(booleanSetting('useShipAutoCalcs', false, false, 'world', refreshWindow));
    settings.style.push(booleanSetting('useProseMirror', false));
    settings.dragDrop.push(booleanSetting('allowDropOnIcon', false));
    settings.dragDrop.push(booleanSetting('allowDragDropOfListsActor', false));
    settings.dragDrop.push(booleanSetting('allowDragDropOfListsShip', false));
    settings.general.push(booleanSetting('useItemActiveEffects', true, false, 'world', deactivateActorAE));
    settings.general.push(booleanSetting('suppressTableWarnings', false, false, 'client'));
    settings.general.push(booleanSetting('useTokenEdgeForDistance', false));
    return settings;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    //context.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.debugSettings.intro`)}</h2>`;
    context.tabs = this.getTabs(DebugSettings.settings, this.tabGroups.primary);
    return context;
  }
}

async function deactivateActorAE () {
  await applyToAllActors(toggleActorItemAEs);
  await applyToAllItems(toggleItemAEs);
}

async function toggleActorItemAEs(actor) {
  for ( const item of actor.items) {
    await toggleItemAEs(item);
  }
}

async function toggleItemAEs(item) {
  for ( const effect of item.effects.contents ) {
    if ( effect.transfer !== game.settings.get('twodsix', 'useItemActiveEffects') ) {
      await effect.update({"transfer": game.settings.get('twodsix', 'useItemActiveEffects')});
    }
  }
}
