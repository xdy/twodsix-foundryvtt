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

  Handlebars.registerHelper('twodsix_limitLength', function (a, b) {
    if (!a) {
      return '';
    } else {
      return a.length > b ? '(...)' : a;
    }
  });

  Handlebars.registerHelper('twodsix_skillCharacteristic', (actor, characteristic) => {
    const actorData = actor.data;
    const characteristicElement = actorData.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
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
    const actorData = actor.data;
    const characteristicElement = actorData.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    let adjValue = value;

    /* only modify if hideUntrained is false and skill value is untrained (-3) */
    if (value === (<Skills>game.system.template.Item?.skills)?.value && !game.settings.get("twodsix", "hideUntrainedSkills")) {
      adjValue = actor.items.find((i) => i._id === actorData.untrainedSkill).data.value;
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

  Handlebars.registerHelper('twodsix_hideUntrainedSkills', (data) => {
    // -1 is case where untrained skill is checked
    if (data === -1) {
      return game.settings.get('twodsix', 'hideUntrainedSkills');
    } else {
      return data.value && (game.settings.get('twodsix', 'hideUntrainedSkills') && data.value < 0  && data.trainingNotes === "");
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

  Handlebars.registerHelper('twodsix_useFoundryStyle', () => {
    return game.settings.get('twodsix', 'useFoundryStandardStyle');
  });

  Handlebars.registerHelper('showAlternativeCharacteristics', () => {
    return game.settings.get('twodsix', 'showAlternativeCharacteristics');
  });

  Handlebars.registerHelper('alternativeShort1', () => {
    return game.settings.get('twodsix', 'alternativeShort1');
  });

  Handlebars.registerHelper('alternativeShort2', () => {
    return game.settings.get('twodsix', 'alternativeShort2');
  });

  Handlebars.registerHelper('autoCalcStats', () => {
    return game.settings.get('twodsix', 'useShipAutoCalcs');
  });

  Handlebars.registerHelper('twodsix_showReferences', () => {
    return game.settings.get('twodsix', 'showItemReferences');
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
        return "fas fa-bed";
      case 'armament':
        return "fas fa-crosshairs";
      case 'armor':
        return "fas fa-grip-vertical";
      case 'bridge':
        return "fas fa-gamepad";
      case 'cargo':
        return "fas fa-boxes";
      case 'computer':
        return "fas fa-microchip";
      case 'drive':
        return "fas fa-arrows-alt";
      case 'drone':
        return "fas fa-satellite";
      case 'electronics':
        return "fas fa-satellite-dish";
      case 'fuel':
        return "fas fa-gas-pump";
      case 'hull':
        return "fas fa-rocket";
      case 'mount':
        return "far fa-dot-circle";
      case "otherExternal":
        return "fas fa-sign-out-alt";
      case "otherInternal":
        return "fas fa-sign-in-alt";
      case 'power':
        return "fas fa-atom";
      case "sensor":
        return "fas fa-solar-panel";
      case 'shield':
        return "fas fa-shield-alt";
      case 'software':
        return "fas fa-code";
      case 'storage':
        return "fas fa-boxes";
      case 'vehicle':
        return "fas fa-space-shuttle";
      default:
        return "fas fa-question-circle";
    }
  });

  Handlebars.registerHelper('twodsix_showWeightUsage', () => {
    return (game.settings.get('twodsix', 'showWeightUsage'));
  });

  Handlebars.registerHelper('twodsix_useTinyMCE', () => {
    return (game.settings.get('twodsix', 'useTinyMCEditor'));
  });

  Handlebars.registerHelper("concat", (...args) => args.slice(0, args.length - 1).join(''));

  Handlebars.registerHelper('each_sort_by_name', (array, options) => {
    let sortedArray: TwodsixItem[] = [];
    const slice: TwodsixItem[] = <TwodsixItem[]>array?.slice(0);
    if (slice) {
      sortedArray = slice.sort((a, b) => {
        if (a.name == null) {
          return 1;
        } else {
          if (b.name == null) {
            return -1;
          } else if (a.name === b.name) {
            return 0;
          } else {
            return a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase());
          }
        }
      });
    }
    return Handlebars.helpers.each(sortedArray, options);
  });

  Handlebars.registerHelper('getComponentWeight', (item: TwodsixItem) => {
    return (Math.round(getWeight(<Component>item.data.data, item.actor?.data) * 10 ) / 10 ).toFixed(1);
  });

  Handlebars.registerHelper('getComponentPower', (item: TwodsixItem) => {
    const anComponent = <Component>item.data.data;
    const retValue:number = getPower(anComponent);
    if (anComponent.generatesPower) {
      return "+" + retValue;
    } else {
      return retValue;
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

  Handlebars.registerHelper('getComponentMaxHits', () => {
    return game.settings.get("twodsix", "maxComponentHits");
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
    return `background-image: conic-gradient(var(--s2d6-pie-color) ${degrees}deg, var(--s2d6-pie-background-color) ${degrees}deg); border-radius: 50%; border:solid;`;
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
