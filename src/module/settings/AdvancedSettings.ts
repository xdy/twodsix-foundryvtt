export default class AdvancedSettings extends FormApplication {
  settings: string[];
  static settings:string[];

  constructor(object, settings:string[], options?) {
    super(object, options);
    this.settings = settings;
  }

  /** @override */
  static get defaultOptions(): FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix"],
      template: "systems/twodsix/templates/misc/advanced-settings.html",
      width: 600
    });
  }

  /** @override */
  getData(): any {
    const data: any = super.getData();
    const settings = this.settings.map((settingName) => {
      const setting: any = game.settings.settings.get("twodsix." + settingName);
      setting.value = game.settings.get(setting.namespace ?? setting.module, settingName);
      if (setting.choices) {
        setting.htmlType = "Select";
      } else {
        setting.htmlType = setting.type.name;
      }
      return [settingName, setting];
    });
    data.settings = Object.fromEntries(settings);
    return data;
  }

  async _updateObject(event, formData): Promise<void> {
    if (event.submitter.name === "submit") {
      Object.entries(formData).forEach(([key, value]) => {
        game.settings.set("twodsix", key, value);
      });
    }
    return Promise.resolve();
  }

  static registerMenu(cls, menuName, icon, restricted = true): void {
    game.settings.registerMenu("twodsix", menuName, {
      name: game.i18n.localize(`TWODSIX.Settings.settingsInterface.${menuName}.name`),
      label: game.i18n.localize(`TWODSIX.Settings.settingsInterface.${menuName}.name`),
      hint: game.i18n.localize(`TWODSIX.Settings.settingsInterface.${menuName}.hint`),
      icon: `fas fa-${icon}`,
      type: cls,
      restricted: restricted
    });
  }
}
