function registerSetting(key, scope, config, defaultValue, type, onChange, choices, localize) {
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

export function booleanSetting(key, defaultValue, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Boolean, onChange);
  return key;
}

export function numberSetting(key, defaultValue, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Number, onChange);
  return key;
}

export function stringChoiceSetting(key, defaultValue, localize = false, choices, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, choices, localize);
  return key;
}

export function stringSetting(key, defaultValue, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange);
  return key;
}

export function colorSetting(key, defaultValue, choices = "Color", config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, choices);
  return key;
}

/**
 * Function to return a camel case version of a string
 * @param {string} string to be converted
 * @returns {object} a camel case version of input string
 * @export
 */
export function camelCase(string) {
  return string.trim().toLowerCase().replace(/\W+(.)/g, (m, chr) => chr.toUpperCase());
}
