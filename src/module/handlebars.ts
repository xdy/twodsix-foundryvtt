import * as util from "util";
import {advantageDisadvantageTerm} from "./i18n";
import {calcModFor, getKeyByValue} from "./utils/sheetUtils";
import {TWODSIX} from "./config";

export default function registerHandlebarsHelpers():void {

  let showedError = false;

  Handlebars.registerHelper('advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

  Handlebars.registerHelper('capitalize', (str) => {
    if (!util.isString(str)) {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('concat', function (a, b) {
    return a + b;
  });

  Handlebars.registerHelper('skillCharacteristic', (actor, characteristic) => {
    const actorData = actor.data;
    const characteristicElement = actorData.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    if (characteristicElement) {
      const mod = calcModFor(characteristicElement.current);
      return game.i18n.localize("TWODSIX.Items.Skills." + characteristicElement.shortLabel) + "(" + (mod < 0 ? "" : "+") + mod + ")";
    } else {
      if (!showedError) {
        ui.notifications.error("TWODSIX.Handlebars.CantShowCharacteristic");
        showedError = true;
      }
      return "XXX";
    }
  });
}
