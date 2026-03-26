/**
 * @param {string} key
 * @param {string} scope
 * @param {boolean} config
 * @param {any} defaultValue
 * @param {Function} type
 * @param {Function | undefined} onChange
 * @param {object | string | undefined} choices
 * @param {boolean | undefined} localize
 * @returns {void}
 */
function registerSetting(key, scope, config, defaultValue, type, onChange, choices, localize) {
  const settingData = {
    name: game.i18n.localize(`TWODSIX.Settings.${key}.name`), //localization doesn't function at this point FVTT automatically localizes later
    hint: game.i18n.localize(`TWODSIX.Settings.${key}.hint`),
    scope: scope,
    config: config,
    default: localize && type !== Array ? game.i18n.localize(defaultValue) : defaultValue,
    type: type,
    onChange: onChange,
    choices: choices,
    localize: localize
  };
  game.settings.register('twodsix', key, settingData);
}

/**
 * @param {string} key
 * @param {boolean} defaultValue
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @returns {string}
 */
export function booleanSetting(key, defaultValue, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Boolean, onChange);
  return key;
}

/**
 * @param {string} key
 * @param {number} defaultValue
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @returns {string}
 */
export function numberSetting(key, defaultValue, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Number, onChange);
  return key;
}

/**
 * @param {string} key
 * @param {string} defaultValue
 * @param {boolean} [localize=false]
 * @param {object} choices
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @returns {string}
 */
export function stringChoiceSetting(
  key,
  defaultValue,
  localize = false,
  choices,
  config = false,
  scope = 'world',
  onChange
) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, choices, localize);
  return key;
}

/**
 * @param {string} key
 * @param {any[]} defaultValue
 * @param {boolean} [localize=false]
 * @param {object} choices
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @returns {string}
 */
export function arrayChoiceSetting(
  key,
  defaultValue,
  localize = false,
  choices,
  config = false,
  scope = 'world',
  onChange
) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, Array, onChange, choices, localize);
  return key;
}

/**
 * @param {string} key
 * @param {string} defaultValue
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @param {boolean | undefined} [localize]
 * @returns {string}
 */
export function stringSetting(key, defaultValue, config = false, scope = 'world', onChange, localize) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, undefined, localize);
  return key;
}

/**
 * @param {string} key
 * @param {string} defaultValue
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @returns {string}
 */
export function largeStringSetting(key, defaultValue, config = false, scope = 'world', onChange) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, "textarea");
  return key;
}

/**
 * @param {string} key
 * @param {string} defaultValue
 * @param {string} [choices="Color"]
 * @param {boolean} [config=false]
 * @param {string} [scope='world']
 * @param {Function | undefined} [onChange]
 * @returns {string}
 */
export function colorSetting(
  key,
  defaultValue,
  choices = "Color",
  config = false,
  scope = 'world',
  onChange
) {
  registerSetting(key.replace('.', ''), scope, config, defaultValue, String, onChange, choices);
  return key;
}

/**
 * Function to return a camel case version of a string
 * @param {string} string to be converted
 * @returns {string} a camel case version of input string
 * @export
 */
export function camelCase(string) {
  return string.trim().toLowerCase().replace(/\W+(.)/g, (m, chr) => chr.toUpperCase());
}
