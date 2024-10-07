// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

// https://stackoverflow.com/a/34749873
/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item):boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param sources
 */
export function mergeDeep(target:Record<string, any>, ...sources:Record<string, any>[]):Record<string, any> {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

/**
 * Returns the localized, default short label based on logical shortLabel
 * @param {string} char the logical, characteristic shortLabel (not the display label)
 * @return {string} the value from the object
 * @public
 * @function
 */
export function getCharShortName(char: string): string {
  switch (char) {
    case "ALT1":
      return game.settings.get('twodsix', 'alternativeShort1');
    case "ALT2":
      return game.settings.get('twodsix', 'alternativeShort2');
    case "ALT3":
      return game.settings.get('twodsix', 'alternativeShort3');
    case "LFB":
    case "STA":
    case "HIT":
      return game.i18n.localize("TWODSIX.Items.Skills." + char);
    default:
      return game.i18n.localize(game.settings.get('twodsix', 'short' + char));
  }
}

/**
 * Returns the simplified skill name by removing white space from the skill's full name
 * @param {string} skillName the skill's full name
 * @return {string} the skill's name with whitespace removed
 * @public
 * @function
 */
export function simplifySkillName(skillName:string): string {
  return skillName.replace(/\W/g, "");
}

/**
 * Returns the value for an object based on the keys in the key string
 * @param {object} o the object
 * @param {string} s they key(s) as a string path with each lower sub key separated by dots, e.g. "key.subKey.subsubKey"
 * @return {any} the value form the object
 * @public
 * @function
 */
export function ObjectbyString(o, s) {
  //https://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-and-arrays-by-string-path
  s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  s = s.replace(/^\./, '');           // strip a leading dot
  const a = s.split('.');
  for (let i = 0, n = a.length; i < n; ++i) {
    const k = a[i];
    if (k in o) {
      o = o[k];
    } else {
      return;
    }
  }
  return o;
}

/**
 * Sort an object alphabettically by key
 * @param {object} obj
 * @returns {object} the sorted object
 */
export function sortObj(obj: object): object {
  return Object.keys(obj).sort().reduce(function (result, key) {
    result[key] = obj[key];
    return result;
  }, {});
}

/**
 * Sort an Array of TwodsixItems by item.name
 * @param {TwodsixItem[]} itemArray
 * @returns {TwodsixItem[]} the sorted item array
 */
export function sortByItemName(itemArray: TwodsixItem[]): TwodsixItem[] {
  return itemArray.sort(function (a:TwodsixItem, b:TwodsixItem) {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    if (aName < bName) {
      return -1;
    } else if (aName > bName) {
      return 1;
    } else {
      return 0;
    }
  });
}

/**
 * Return a value as a string with added +/- sign
 * @param {number} value
 * @returns {string} the value as string with sign
 */
export function addSign(value:number):string {
  return `${value <= 0 ? "" : "+"}${value}`;
}

/**
 * Simple function to return a string with first character capitalized
 * @param {string} inputString
 * @returns {string} the string with first letter capitalized
 */
export function capitalizeFirstLetter(inputString:string):string {
  if (inputString[0]) {
    return inputString[0].toUpperCase() + inputString.slice(1);
  } else {
    return "";
  }
}

/**
 * A function for getting the full characteristic key from the displayed short label.
 * @param {string} char           The displayed characteristic short label.
 * @param {TwodsixActor} actor    The Actor in question.
 * @returns {string}              Full logical name (key) of the characteristic.
 */
export function getCharacteristicFromDisplayLabel(char:string, actor?:TwodsixActor):string {
  let tempObject = {};
  let charObject= {};
  if (actor) {
    charObject = actor.system["characteristics"];
    for (const key in charObject) {
      tempObject[key] = charObject[key].displayShortLabel;
    }
  } else {
    tempObject = TWODSIX.CHARACTERISTICS;
  }
  return getKeyByValue(tempObject, char);
}

/**
 * Round half away from zero ('commercial' rounding)
 * Uses correction to offset floating-point inaccuracies. Works symmetrically for positive and negative numbers.
 * @param {number} num the number to be rounded to a specific decimal position
 * @param {number} decimalPlaces number of decimal places
 * @returns {number} num rounded to a specific decimal postion
 */
export function roundToDecimal(num:number, decimalPlaces:number): number {
  const p = Math.pow(10, decimalPlaces);
  const e = Number.EPSILON * num * p;
  return Math.round((num * p) + e) / p;
}

/**
 * Round to use a maximum number of decimals depending on size of num
 * Uses correction to offset floating-point inaccuracies. Works symmetrically for positive and negative numbers.
 * @param {number} num the number to be rounded to a specific decimal position
 * @param {number} maxDecimals max number of decimals
 * @returns {number} num rounded to a specific decimal postion
 */
export function roundToMaxDecimals(num:number, maxDecimals:number): number {
  const decimalsToShow = Math.min(maxDecimals, Math.max(0, maxDecimals - Math.floor(Math.log10(Math.abs(num)))));
  return roundToDecimal(num, decimalsToShow);
}

export function getKeyByValue(object:{ [x:string]:unknown; }, value:unknown):string {
  //TODO This assumes I always find the value. Bad form really.
  return <string>Object.keys(object).find(key => JSON.stringify(object[key]) === JSON.stringify(value));
}
