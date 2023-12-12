// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

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

export function largeStringSetting(key: string, defaultValue: string, config = false, scope = 'world', onChange?: ((value: string) => void) | undefined): string {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, "textarea");
  return key;
}

export function colorSetting(key: string, defaultValue: string, choices = "Color", config = false, scope = 'world', onChange?: ((value: string) => void) | undefined): string {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, choices);
  return key;
}

/**
 * Function to return a camel case version of a string
 * @param {string} string to be converted
 * @returns {object} a camel case version of input string
 * @export
 */
export function camelCase(string:string):string {
  return string.trim().toLowerCase().replace(/\W+(.)/g, (m, chr) => chr.toUpperCase());
}
