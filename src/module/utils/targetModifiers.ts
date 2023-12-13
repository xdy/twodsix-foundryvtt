// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

/**
 * A function that parses the string setting 'targetDMList' into an object and saves the object to TWODSIX.TARGET_DM.
 * Always adds a {key0: {value: 0, label:'None'}} entry to object
 * @returns {void}
 */
export function generateTargetDMObject():void {
  const modifierObject = {
    "key0": {
      label: game.i18n.localize("TWODSIX.Chat.Roll.RangeModifierTypes.none"),
      value: 0
    }
  };
  const parseString:string = game.settings.get('twodsix', 'targetDMList');
  if (parseString !== "") {
    let i = 1;
    const customDMs:string[] = parseString.replace(/[\t\n\r]/gm, ' ').split(',');
    for (const modifier of customDMs) {
      // eslint-disable-next-line no-useless-escape
      const re = new RegExp(/([^\d]*?)([-+]?\d+$)/g);
      const parsedResult: RegExpMatchArray | null = re.exec(modifier);
      if (parsedResult) {
        const keyValue = `key${i}`;
        Object.assign(modifierObject, {
          [keyValue]: {
            label: parsedResult[1].trim() || game.i18n.localize("TWODSIX.Ship.Unknown"),
            value: parseInt(parsedResult[2]) || 0
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
 * A function that takes the string setting 'targetDMList' parses it into an object and saves it to TWODSIX.TARGET_DM
 * @returns {object} A select object with format {key# : 'Target DM Label (DM Val)'} useable for selectObject handlebar helper
 */
export function getTargetDMSelectObject(): object {
  const returnValue = {};
  for (const key of Object.keys(TWODSIX.TARGET_DM)) {
    Object.assign(returnValue, {
      [key]: `${TWODSIX.TARGET_DM[key].label} (${TWODSIX.TARGET_DM[key].value})`
    });
  }
  return returnValue;
}

