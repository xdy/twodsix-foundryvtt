// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

export default class AdvancedSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  settings: any;
  static settings:any;

  constructor(object, settings:any, options?) {
    super(object, options);
    this.settings = settings;
  }

  /** @override */
  async _prepareContext(options): any {
    const context: any = await super._prepareContext(options);
    context.useTabbedViews = game.settings.get('twodsix', 'useTabbedViews');
    context.settings = {};
    for(const group in this.settings) {
      const subgroupSettings = this.settings[group].map((settingName) => {
        const setting: any = game.settings.settings.get("twodsix." + settingName);
        setting.value = game.settings.get(setting.namespace ?? setting.module, settingName);
        if (setting.choices === "Color") {
          setting.htmlType = "Color";
        } else if (setting.choices === "textarea") {
          setting.htmlType = "Textarea";
        } else if (setting.choices) {
          setting.htmlType = setting.type === Array ? "MultiSelect": "Select";
        } else {
          setting.htmlType = setting.type.name;
        }
        return [settingName, setting];
      });
      context.settings[group] = Object.fromEntries(subgroupSettings);
    }
    context.dtypes = ["String", "Number", "Boolean"];
    context.buttons =  [
      { type: "submit", icon: "fa-solid fa-save", label: "Save" },
      { type: "cancel", icon: "fa-solid fa-circle-x", label: "Cancel" }
    ];
    return context;
  }

  /**
   * Process form submission for the sheet
   * @this {MyApplication}                      The handler is called with the application as its bound scope
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {Promise<void>}
   */
  static async onSubmit(event:SubmitEvent, form:HTMLFormElement, formData:FormDataExtended): Promise<void> {
    if (event.type === "submit") {
      const settings = foundry.utils.expandObject(formData.object);
      Object.entries(settings).forEach(async ([key, value]) => {
        if (key != "submit" && key != "cancel") {
          await game.settings.set("twodsix", key, value);
        }
      });
    }
    return Promise.resolve();
  }

  static registerMenu(cls, menuName, icon, restricted = true): void {
    game.settings.registerMenu("twodsix", menuName, {
      name: game.i18n.localize(`TWODSIX.Settings.settingsInterface.${menuName}.name`),
      label: game.i18n.localize(`TWODSIX.Settings.settingsInterface.${menuName}.name`),
      hint: game.i18n.localize(`TWODSIX.Settings.settingsInterface.${menuName}.hint`),
      icon: `fa-solid fa-${icon}`,
      type: cls,
      restricted: restricted
    });
  }
  /**
   * Prepare a record of form tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  getTabs(settings: any, initialTab:string): ApplicationTab {
    const tabs = {};
    for(const key of Object.keys(settings)){
      Object.assign(tabs, {[key]: {id: key, group: "primary", icon: getSettingIcon(key), label: `TWODSIX.Settings.menuLabels.${key}`}}) ;
    }

    for ( const v of Object.values(tabs) ) {
      v.active = initialTab === v.id;
      v.cssClass = v.active ? "active" : "";
    }

    return tabs;
  }
}

function getSettingIcon(settingSubtype: string): string {
  switch (settingSubtype) {
    case 'general':
      return "fa-solid fa-gear";
    case 'roll':
      return "fa-solid fa-dice-six";
    case 'characteristics':
      return "fa-solid fa-clipboard-user";
    case 'formulas':
      return "fa-solid fa-calculator";
    case 'damage':
      return "fa-solid fa-burst";
    case 'movement':
      return "fa-solid fa-person-walking";
    case 'encumbrance':
      return "fa-solid fa-weight-scale";
    case 'wounds':
      return "fa-solid fa-user-injured";
    case 'ship':
      return "fa-solid fa-rocket";
    case 'animals_robots':
      return "fa-solid fa-ghost";
    case 'weapon':
      return "fa-solid fa-gun";
    case 'token':
      return "fa-solid fa-chess-pawn";
    case 'actor':
      return "fa-regular fa-person";
    case "dragDrop":
      return "fa-solid fa-square-caret-down";
    case "style":
      return "fa-solid fa-file-code";
    default:
      return "fa-solid fa-circle-question";
  }
}
