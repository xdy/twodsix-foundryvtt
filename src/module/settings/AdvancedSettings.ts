// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

export default class AdvancedSettings extends FormApplication {
  settings: any;
  static settings:any;

  constructor(object, settings:any, options?) {
    super(object, options);
    this.settings = settings;
  }

  /** @override */
  static get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix"],
      template: "systems/twodsix/templates/misc/advanced-settings.html",
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description"}],
      resizable: true,
      width: 675,
      height: 'auto'
    });
  }

  /** @override */
  getData(): any {
    const data: any = super.getData();
    data.useTabbedViews = game.settings.get('twodsix', 'useTabbedViews');
    data.settings = {};
    for(const group in this.settings) {
      const settings = this.settings[group].map((settingName) => {
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
      data.settings[group] = Object.fromEntries(settings);
    }
    data.dtypes = ["String", "Number", "Boolean"];
    return data;
  }

  async _updateObject(event, formData): Promise<void> {
    if (event.submitter.name === "submit") {
      Object.entries(formData).forEach(([key, value]) => {
        if (key != "submit" && key != "cancel") {
          game.settings.set("twodsix", key, value);
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
}
