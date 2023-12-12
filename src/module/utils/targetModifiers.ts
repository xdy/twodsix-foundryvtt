// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

export function generateTargetDMObject() {
  const modifierObject = {
    "key0": {
      label: game.i18n.localize("TWODSIX.Chat.Roll.RangeModifierTypes.none"),
      value: 0
    }
  };
  const parseString:string = game.settings.get('twodsix', 'targetDMList');
  if (parseString !== "") {
    let i = 1;
    const customDMs:string[] = parseString.split(',');
    for (const modifier of customDMs) {
      // eslint-disable-next-line no-useless-escape
      const re = new RegExp(/([^0-9]*?)([-+]?\d+$)/g);
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

export function getTargetDMSelectObject(): object {
  const returnValue = {};
  for (const key of Object.keys(TWODSIX.TARGET_DM)) {
    Object.assign(returnValue, {
      [key]: `${TWODSIX.TARGET_DM[key].label} (${TWODSIX.TARGET_DM[key].value})`
    });
  }
  return returnValue;
}

