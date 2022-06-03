function registerSetting(key, scope, config, defaultValue, type, onChange, choices?, localize?) {
  const settingData = {
    name: game.i18n.localize(`TWODSIX.Settings.${key}.name`),
    hint: game.i18n.localize(`TWODSIX.Settings.${key}.hint`),
    scope: scope,
    config: config,
    default: defaultValue,
    type: type,
    onChange: onChange,
    choices: choices,
    localize: localize
  };
  game.settings.register('twodsix', key, settingData);
}

export function booleanSetting(key: string, defaultValue: boolean, config = false, scope = 'world', onChange?: ((value: boolean) => void) | undefined): string {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Boolean, onChange);
  return key;
}

export function numberSetting(key: string, defaultValue: number, config = false, scope = 'world', onChange?: ((value: number) => void) | undefined): string {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Number, onChange);
  return key;
}

export function stringChoiceSetting(key: string, defaultValue: string, localize = false, choices, config = false, scope = 'world', onChange?: ((value: string) => void) | undefined): string {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, choices, localize);
  return key;
}

export function stringSetting(key: string, defaultValue: string, config = false, scope = 'world', onChange?: ((value: string) => void) | undefined): string {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange);
  return key;
}
