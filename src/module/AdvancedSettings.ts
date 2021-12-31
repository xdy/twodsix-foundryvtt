export default class AdvancedSettings extends FormApplication {
    settings = [];
    intro = "";

    /** @override */
    // @ts-ignore
    static get defaultOptions(): FormApplicationOptions {
        // @ts-ignore
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
            const setting = game.settings.settings.get("twodsix." + settingName);
            setting["value"] = game.settings.get(setting.namespace ?? setting.module, settingName);
            if (setting.choices) {
                setting["htmlType"] = "Select";
            } else {
                setting["htmlType"] = setting.type.name;
            }
            return [settingName, setting];
        });
        data.intro = this.intro;
        data.settings = Object.fromEntries(settings);
        return data;
    }

    async _updateObject(event, formData): Promise<void> {
        if (event.submitter.name === "submit") {
            console.log(formData)
            Object.entries(formData).forEach(([key, value]) => {
                game.settings.set("twodsix", key, value);
            });
        }
        return Promise.resolve();
    }
}