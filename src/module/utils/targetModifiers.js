
import { TWODSIX } from "../config";

/**
 * Parses the string setting 'targetDMList' into an object and saves the object to TWODSIX.TARGET_DM.
 * The resulting object has the format:
 * {
 *   key#: {
 *     label: string,
 *     value: number,
 *     key: string,
 *     statusKey: string,
 *     linkString: string
 *   }
 * }
 * @returns {void}
 */
export function generateTargetDMObject() {
  const modifierObject = {};
  const parseString = game.settings.get('twodsix', 'targetDMList');
  if (parseString !== "") {
    let i = 0;
    const customDMs = parseString.replace(/[\t\n\r]/gm, ' ').split(',');
    for (const modifier of customDMs) {
      // eslint-disable-next-line no-useless-escape
      const re = new RegExp(/([^\|]+)(?:\s+)([+-]?\d+?)(?:\s*\|*\s*)(.*)$/gm);
      const parsedResult = re.exec(modifier);
      if (parsedResult) {
        const keyValue = `key${i}`;
        const label = parsedResult[1].trim() || game.i18n.localize("TWODSIX.Ship.Unknown");
        const value = parseInt(parsedResult[2]) || 0;
        const remainder = parsedResult[3] ? parsedResult[3].trim() : "";
        const link = remainder || label; //As backup try to link to label rather than an explict stirng coming after a |
        const statusKey = CONFIG.statusEffects.find(se => link === game.i18n.localize(se.name))?.id || "";
        Object.assign(modifierObject, {
          [keyValue]: {
            label,
            value,
            key: keyValue,
            statusKey,
            linkString: link
          }
        });
        ++i;
      }
    }
  }
  TWODSIX.TARGET_DM = modifierObject;
  // console.log(TWODSIX.TARGET_DM, Object.keys(TWODSIX.TARGET_DM).length, getTargetDMSelectObject());
}

/**
 * Returns a select object for Handlebars helpers, built from TWODSIX.TARGET_DM.
 * The returned object has the format:
 * {
 *   key#: 'Target DM Label (DM Val)'
 * }
 * @returns {object} Select object for Handlebars select helper.
 */
export function getTargetDMSelectObject() {
  const returnValue = {};
  for (const key of Object.keys(TWODSIX.TARGET_DM)) {
    Object.assign(returnValue, {
      [key]: `${TWODSIX.TARGET_DM[key].label} (${TWODSIX.TARGET_DM[key].value})`
    });
  }
  return returnValue;
}

/**
 * Returns an array of keys from TWODSIX.TARGET_DM that match the target actor's statuses and traits.
 * Statuses are matched by statusKey, traits by linkString.
 * @param {TwodsixActor} targetActor actor for the target
 * @returns {string[]} An array of keys from TWODSIX.TARGET_DM
 */
export function getTargetStatusModifiers(targetActor) {
  const returnValue = [];
  /* Check that TARGET_DM const isn't undefined */
  if (!TWODSIX.TARGET_DM && game.settings.get('twodsix', 'targetDMList') !== "") {
    generateTargetDMObject();
  }
  const targetDMObject = Object.values(TWODSIX.TARGET_DM);
  if (targetActor) {
    //link statuses
    for (const statusApplied of Array.from(targetActor.statuses)) {
      const linkedDM = targetDMObject.find( targetDM => targetDM.statusKey === statusApplied);
      if (linkedDM) {
        returnValue.push(linkedDM.key);
      }
    }

    //link traits
    for (const trait of targetActor.itemTypes.trait) {
      const linkedDM = targetDMObject.find( targetDM => targetDM.linkString === trait.name);
      if (linkedDM) {
        returnValue.push(linkedDM.key);
      }
    }
  }
  return returnValue;
}
