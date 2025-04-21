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
  static async onSubmit(event: SubmitEvent, form: HTMLFormElement, formData: FormDataExtended): Promise<void> {
    if (event.type === "submit") {
      const settings = foundry.utils.expandObject(formData.object);
      for (const [key, value] of Object.entries(settings)) {
        if (key !== "submit" && key !== "cancel") {
          await game.settings.set("twodsix", key, value);
        }
      }
    }
  }

  static registerMenu(cls, menuName, icon, restricted = true): void {
    const localizationPrefix = "TWODSIX.Settings.settingsInterface";
    game.settings.registerMenu("twodsix", menuName, {
      name: game.i18n.localize(`${localizationPrefix}.${menuName}.name`),
      label: game.i18n.localize(`${localizationPrefix}.${menuName}.name`),
      hint: game.i18n.localize(`${localizationPrefix}.${menuName}.hint`),
      icon: `fa-solid fa-${icon}`,
      type: cls,
      restricted: restricted
    });
  }
  /**
   * Prepare a record of form tabs.
   * @returns {Record<string, Partial<ApplicationTab>>}
   */
  getTabs(settings: Record<string, unknown>, initialTab: string): Record<string, ApplicationTab> {
    const tabs: Record<string, ApplicationTab> = {};

    for (const key of Object.keys(settings)) {
      tabs[key] = {
        id: key,
        group: "primary",
        icon: getSettingIcon(key),
        label: `TWODSIX.Settings.menuLabels.${key}`,
        active: initialTab === key,
        cssClass: initialTab === key ? "active" : ""
      };
    }

    return tabs;
  }
}

/**
 * Get the Font Awesome icon string for a given setting subtype.
 * @param {string} settingSubtype - The subtype of the setting.
 * @returns {string} - Font Awesome icon string reference/id.
 */
function getSettingIcon(settingSubtype: string): string {
  const iconMap: Record<string, string> = {
    general: "fa-solid fa-gear",
    roll: "fa-solid fa-dice-six",
    characteristics: "fa-solid fa-clipboard-user",
    formulas: "fa-solid fa-calculator",
    damage: "fa-solid fa-burst",
    movement: "fa-solid fa-person-walking",
    encumbrance: "fa-solid fa-weight-scale",
    wounds: "fa-solid fa-user-injured",
    ship: "fa-solid fa-rocket",
    animals_robots: "fa-solid fa-ghost",
    weapon: "fa-solid fa-gun",
    token: "fa-solid fa-chess-pawn",
    actor: "fa-regular fa-person",
    dragDrop: "fa-solid fa-square-caret-down",
    style: "fa-solid fa-file-code"
  };

  // Return the corresponding icon or a default icon
  return iconMap[settingSubtype] || "fa-solid fa-circle-question";
}
