/** @typedef {import("../entities/TwodsixItem").default} TwodsixItem */

/**
 * Returns the localized, default short label based on logical shortLabel
 * @param {string} char the logical, characteristic shortLabel (not the display label)
 * @return {string} the value from the object
 */
export function getCharShortName(char) {
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
 */
export function simplifySkillName(skillName) {
  return skillName.replace(/\W/g, "");
}

/**
 * Returns the value for an object based on the keys in the key string
 * @param {object} o the object
 * @param {string} s they key(s) as a string path with each lower sub key separated by dots, e.g. "key.subKey.subsubKey"
 * @return {any} the value form the object
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
 * Sort an object alphabetically by key
 * @param {object} obj
 * @returns {object} the sorted object
 */
export function sortObj(obj) {
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
export function sortByItemName(itemArray) {
  return itemArray.sort((a, b) =>
    a.name.localeCompare(b.name, game.i18n.lang, {sensitivity: 'base'})
  );
}

/**
 * Return a value as a string with added +/- sign
 * @param {number} value
 * @returns {string} the value as string with sign
 */
export function addSign(value) {
  return value === 0 ? "" : `${value > 0 ? "+" : ""}${value}`;
}

/**
 * Simple function to return a string with first character capitalized
 * @param {string} inputString
 * @returns {string} the string with first letter capitalized
 */
export function capitalizeFirstLetter(inputString) {
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
export function getCharacteristicFromDisplayLabel(char, actor) {
  let tempObject = {};
  let charObject = {};
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
export function roundToDecimal(num, decimalPlaces) {
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
export function roundToMaxDecimals(num, maxDecimals) {
  const decimalsToShow = Math.min(maxDecimals, Math.max(0, maxDecimals - Math.floor(Math.log10(Math.abs(num)))));
  return roundToDecimal(num, decimalsToShow);
}

/**
 * Find the first key whose JSON-serialised value matches the provided value.
 * @param {object} object - Search target object
 * @param {any} value - Value to match
 * @returns {string | undefined} The matching key, the fallback, or undefined if nothing matches
 */
export function getKeyByValue(object, value) {
  if (!value || value === "NONE") {
    return undefined;
  }
  const compareValue = JSON.stringify(value);
  const returnKey = Object.keys(object).find(key => JSON.stringify(object[key]) === compareValue);
  if (returnKey !== undefined) {
    return returnKey;
  }
  console.warn("utils.getKeyByValue: value not found", {value, object});
  return undefined;
}

/**
 * Remove string value from string array.  Removes first instance.
 * @param {[string]} arr the intial array of strings
 * @param {string} value the string value to remove
 * @returns {[string]} the revised string array without value
 */
export function removeStringElement(arr, value) {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

/**
 * Utility to rewrite @system.xyz to @xyz in roll formulas for FVTT changes to AE's in v14.
 * @param {string} formula - The formula string to clean.
 * @returns {string} - The cleaned formula string.
 */
export function cleanSystemReferences(formula) {
  if (typeof formula !== 'string') {
    return formula;
  }
  return formula.replace(/@system\./g, '@');
}

/**
 * Assigns a default image to a document if it currently uses a default Foundry icon.
 * @param {ClientDocument} doc  The Document to update (Actor or Item).
 * @param {object} updates      The updates object to modify.
 * @param {object} data         The initial data provided to the creation request.
 * @param {string} defaultIcon  The system-specific default icon for this document type.
 * @returns {void}
 */
export function assignDefaultImage(doc, updates, data, defaultIcon) {
  const foundryDefault = doc instanceof Actor ? "icons/svg/mystery-man.svg" : "icons/svg/item-bag.svg";
  const isDefaultImg = (!data.img || data.img === foundryDefault) && (!doc.img || doc.img === foundryDefault);

  if (defaultIcon && defaultIcon !== foundryDefault && isDefaultImg) {
    Object.assign(updates, {img: defaultIcon});

    if (doc instanceof Actor) {
      const tokenSrc = game.settings.get("twodsix", "useSystemDefaultTokenIcon")
        ? foundryDefault
        : defaultIcon;

      doc.prototypeToken.updateSource({
        texture: {src: tokenSrc}
      });
    }
  }
}

/**
 * Convert an integer 0–15 to its UPP hex character (0–9, A–F).
 * Used for Universal Personality Profile display.
 * @param {number} n  Integer in the range 0–15.
 * @returns {string}  Single character string.
 */
export function toHex(n) {
  return n < 10 ? String(n) : String.fromCharCode(55 + n);
}
