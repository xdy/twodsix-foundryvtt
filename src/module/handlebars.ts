// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { advantageDisadvantageTerm } from "./i18n";
import { calcModFor, getKeyByValue } from "./utils/sheetUtils";
import { TWODSIX } from "./config";
import TwodsixItem from "./entities/TwodsixItem";
import {Skills, Component} from "../types/template";
import TwodsixActor, { getPower, getWeight } from "./entities/TwodsixActor";
import { _genTranslatedSkillList, _genUntranslatedSkillList } from "./utils/TwodsixRollSettings";

export default function registerHandlebarsHelpers(): void {

  let showedError = false;

  Handlebars.registerHelper('twodsix_advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

  Handlebars.registerHelper('twodsix_difficultiesAsTargetNumber', () => {
    return game.settings.get('twodsix', 'difficultiesAsTargetNumber');
  });

  Handlebars.registerHelper('twodsix_isOdd', (num:number) => {
    return (num % 2) == 1;
  });

  Handlebars.registerHelper('twodsix_product', (num1:number, num2:number) => {
    return (num1 ?? 0) * (num2 ?? 0);
  });

  Handlebars.registerHelper('twodsix_capitalize', (str) => {
    if (typeof str !== 'string') { // this was === before, but seems like it should have been !==
      return '';
    } else {
      const thing: string = str;
      return str.charAt(0).toLocaleUpperCase() + (thing.length > 1 ? thing.slice(1) : "");
    }
  });

  Handlebars.registerHelper('twodsix_titleCase', (str) => {
    if (typeof str !== 'string') { // this was === before, but seems like it should have been !==
      return '';
    } else {
      //const thing: string = str;
      //return str.charAt(0).toLocaleUpperCase() + (thing.length > 1 ? thing.slice(1) : "");
      return str.toLowerCase().split(' ').map(function(word) {
        return (word.charAt(0).toUpperCase() + word.slice(1));
      }).join(' ');
    }
  });

  Handlebars.registerHelper('twodsix_limitLength', function (a, b) {
    if (!a) {
      return '';
    } else {
      return a.length > b ? '(...)' : a;
    }
  });

  Handlebars.registerHelper('twodsix_skillCharacteristic', (actor, characteristic) => {
    const characteristicElement = actor.system.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    if (characteristicElement) {
      const mod: number = calcModFor(characteristicElement.current);
      const abbreviatedCharName: string = characteristicElement.displayShortLabel;
      return abbreviatedCharName + "(" + (mod < 0 ? "" : "+") + mod + ")";
    } else if ('NONE' === characteristic) {
      return game.i18n.localize("TWODSIX.Items.Skills.NONE");
    } else {
      if (!showedError) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Handlebars.CantShowCharacteristic"));
        showedError = true;
      }
      return "XXX";
    }
  });

  Handlebars.registerHelper('twodsix_localizeConsumable', (type) => {
    return game.i18n.localize(`TWODSIX.Items.Consumable.Types.${type}`);
  });

  Handlebars.registerHelper('twodsix_refillText', (subtype, quantity) => {
    const refillWord = ["magazine", "power_cell"].includes(subtype) ? "Reload" : "Refill";
    return `${game.i18n.localize(`TWODSIX.Actor.Items.${refillWord}`)} (${quantity - 1})`;
  });

  Handlebars.registerHelper('twodsix_skillTotal', (actor, characteristic, value) => {
    const characteristicElement = actor.system.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    let adjValue = value;

    /* only modify if hideUntrained is false and skill value is untrained (-3) */
    if (value === (<Skills>game.system.template.Item?.skills)?.value && !game.settings.get("twodsix", "hideUntrainedSkills")) {
      adjValue = actor.items.find((i) => i._id === actor.system.untrainedSkill).system.value;
    }

    if (characteristicElement) {
      if (!characteristicElement.current) {
        characteristicElement.current = characteristicElement.value - characteristicElement.damage;
      }

      const mod = calcModFor(characteristicElement.current);
      return Number(adjValue) + mod;
    } else {
      return adjValue;
    }
  });

  Handlebars.registerHelper('twodsix_invertSkillRollShiftClick', () => {
    if (game.settings.get('twodsix', 'invertSkillRollShiftClick')) {
      return game.i18n.localize("TWODSIX.Actor.Skills.InvertedSkillRollTooltip");
    } else {
      return game.i18n.localize("TWODSIX.Actor.Skills.SkillRollTooltip");
    }
  });

  Handlebars.registerHelper('twodsix_hideUntrainedSkills', (inData) => {
    // -1 is case where untrained skill is checked
    if (inData === -1) {
      return game.settings.get('twodsix', 'hideUntrainedSkills');
    } else {
      return inData.value && (game.settings.get('twodsix', 'hideUntrainedSkills') && inData.value < 0  && inData.trainingNotes === "");
    }
  });

  Handlebars.registerHelper('twodsix_burstModes', (weapon) => {
    // Parse rates of fire, and ignore the first number (usually 1, but can be 0, which means no single fire)
    const modes = (weapon.rateOfFire ?? "").split(/[-/]/);
    modes.shift();
    return modes;
  });

  Handlebars.registerHelper('twodsix_useCEAutofireRules', () => {
    return (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key);
  });

  Handlebars.registerHelper('twodsix_useCELAutofireRules', (weapon) => {
    return ((game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) && (weapon.rateOfFire > 1));
  });

  Handlebars.registerHelper('twodsix_burstAttackDM', (burstSize: string) => {
    const number = Number(burstSize);
    return TwodsixItem.burstAttackDM(number);
  });

  Handlebars.registerHelper('twodsix_burstBonusDamage', (burstSize) => {
    const number = Number(burstSize);
    return TwodsixItem.burstBonusDamage(number);
  });

  Handlebars.registerHelper('twodsix_filterSkills', (skill) => {
    return skill != null && !skill.getFlag("twodsix", "untrainedSkill") && skill.type === "skills";
  });

  Handlebars.registerHelper('alternativeShort1', () => {
    return game.settings.get('twodsix', 'alternativeShort1');
  });

  Handlebars.registerHelper('alternativeShort2', () => {
    return game.settings.get('twodsix', 'alternativeShort2');
  });

  Handlebars.registerHelper('skillName', (skillName) => {
    return TwodsixItem.simplifySkillName(skillName);
  });

  Handlebars.registerHelper('replace', (text, key, value) => {
    return text.replaceAll(key, value);
  });

  Handlebars.registerHelper('twodsix_getComponentIcon', (componentType: string) => {
    switch (componentType) {
      case 'accomodations':
        return "fa-solid fa-bed";
      case 'armament':
        return "fa-solid fa-crosshairs";
      case 'armor':
        return "fa-solid fa-grip-vertical";
      case 'bridge':
        return "fa-solid fa-person-seat";
      case 'cargo':
        return "fa-solid fa-boxes-stacked";
      case 'computer':
        return "fa-solid fa-computer";
      case 'dock':
        return "fa-solid fa-arrow-right-arrow-left";
      case 'drive':
        return "fa-solid fa-up-down-left-right";
      case 'drone':
        return "fa-solid fa-satellite";
      case 'electronics':
        return "fa-solid fa-microchip";
      case 'fuel':
        return "fa-solid fa-gas-pump";
      case 'hull':
        return "fa-solid fa-rocket";
      case 'mount':
        return "fa-regular fa-circle-dot";
      case "otherExternal":
        return "fa-solid fa-right-from-bracket";
      case "otherInternal":
        return "fa-solid fa-right-to-bracket";
      case 'power':
        return "fa-solid fa-atom";
      case "sensor":
        return "fa-solid fa-solar-panel";
      case 'shield':
        return "fa-solid fa-shield-halved";
      case 'software':
        return "fa-solid fa-code";
      case 'storage':
        return "fa-solid fa-boxes-stacked";
      case 'vehicle':
        return "fa-solid fa-shuttle-space";
      default:
        return "fa-solid fa-circle-question";
    }
  });

  Handlebars.registerHelper('twodsix_showTimeframe', () => {
    return game.settings.get('twodsix', 'showTimeframe');
  });

  Handlebars.registerHelper("concat", (...args) => args.slice(0, args.length - 1).join(''));  //Needed? In FVTT baseline

  Handlebars.registerHelper('each_sort_item', (array, options) => {
    let sortedArray: TwodsixItem[] = [];
    const sortLabel = game.settings.get('twodsix', 'allowDragDropOfLists') ? "sort" : "name";
    const slice: TwodsixItem[] = <TwodsixItem[]>array?.slice(0);
    if (slice) {
      sortedArray = slice.sort((a, b) => {
        if (a[sortLabel] == null) {
          return 1;
        } else {
          if (b[sortLabel] == null) {
            return -1;
          } else if (a[sortLabel] === b[sortLabel]) {
            return 0;
          } else {
            if (game.settings.get('twodsix', 'allowDragDropOfLists')) {
              return a.sort - b.sort;
            } else {
              return a.name.localeCompare(b.name);
            }
          }
        }
      });
    }
    return Handlebars.helpers.each(sortedArray, options);
  });

  Handlebars.registerHelper('getComponentWeight', (item: TwodsixItem) => {
    return getWeight(<Component>item.system, item.actor).toLocaleString(game.i18n.lang, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  });

  Handlebars.registerHelper('getComponentPower', (item: TwodsixItem) => {
    const anComponent = <Component>item.system;
    const retValue:number = getPower(anComponent);
    if (anComponent.generatesPower) {
      return "+" + retValue.toLocaleString(game.i18n.lang);
    } else {
      return retValue.toLocaleString(game.i18n.lang);
    }
  });

  Handlebars.registerHelper('getComponentMaxHits', () => {
    return game.settings.get("twodsix", "maxComponentHits");
  });

  Handlebars.registerHelper('getCharacteristicList', (actor: TwodsixActor) => {
    let returnValue = {};
    if (actor) {
      returnValue = _genTranslatedSkillList(actor);
    } else {
      returnValue = _genUntranslatedSkillList();
    }
    return returnValue;
  });

  Handlebars.registerHelper('makePieImage', (text: string) => {
    //const re = new RegExp(/([0-9]*\.?[0-9]*)\s*%/gm);
    const re = new RegExp(/(\d+)(\s?)\/(\s?)(\d+)/gm);
    const parsedResult: RegExpMatchArray | null = re.exec(text);
    let inputPercentage = 0.5;
    if (parsedResult) {
      inputPercentage = Number(parsedResult[1]) / Number(parsedResult[4]);
      if (inputPercentage > 1) {
        inputPercentage = 1;
      }
      if (inputPercentage < 0 ) {
        inputPercentage = 0;
      }
    }
    const degrees = Math.round(inputPercentage * 360);
    return `background-image: conic-gradient(var(--s2d6-pie-color) ${degrees}deg, var(--s2d6-pie-background-color) ${degrees}deg); border-radius: 50%; border: 1px solid;`;
  });

  // Handy for debugging
  Handlebars.registerHelper('debug', function (context) {
    console.log(context);
    return JSON.stringify(context);
  });

  //From https://discord.com/channels/732325252788387980/732328233630171188/790507540818690068
  Handlebars.registerHelper("iff", function (v1, operator, v2, options) {
    let expression: boolean;
    switch (operator) {
      case '==':
        expression = v1 == v2;
        break;
      case '===':
        expression = v1 === v2;
        break;
      case '!=':
        expression = v1 != v2;
        break;
      case '!==':
        expression = v1 !== v2;
        break;
      case '<':
        expression = v1 < v2;
        break;
      case '<=':
        expression = v1 <= v2;
        break;
      case '>':
        expression = v1 > v2;
        break;
      case '>=':
        expression = v1 >= v2;
        break;
      case '&&':
        expression = v1 && v2;
        break;
      case '||':
        expression = v1 || v2;
        break;
      default:
        return options.inverse(this);
    }
    return expression ? options.fn(this) : options.inverse(this);
  });

}
