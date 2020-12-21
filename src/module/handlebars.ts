import {advantageDisadvantageTerm} from "./i18n";
import {calcModFor, getKeyByValue} from "./utils/sheetUtils";
import {TWODSIX} from "./config";

export default function registerHandlebarsHelpers():void {

  let showedError = false;

  Handlebars.registerHelper('twodsix_advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

  Handlebars.registerHelper('twodsix_capitalize', (str) => {
    if (typeof str === 'string') {
      return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('twodsix_limitLength', function (a, b) {
    return a.length > b ? '(...)' : a;
  });

  Handlebars.registerHelper('twodsix_skillCharacteristic', (actor, characteristic) => {
    const actorData = actor.data;
    const characteristicElement = actorData.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    if (characteristicElement) {
      const mod:number = calcModFor(characteristicElement.current);
      return game.i18n.localize("TWODSIX.Items.Skills." + characteristic) + "(" + (mod < 0 ? "" : "+") + mod + ")";
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

  Handlebars.registerHelper('twodsix_skillTotal', (actor, characteristic, value) => {
    const actorData = actor.data;
    const characteristicElement = actorData.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    if (characteristicElement) {
      if (!characteristicElement.current) {
        characteristicElement.current = characteristicElement.value - characteristicElement.damage;
      }

      const mod = calcModFor(characteristicElement.current);
      return Number(value) + mod;
    } else {
      return value;
    }
  });

  Handlebars.registerHelper('twodsix_hideUntrainedSkills', (value) => {
    return value && (game.settings.get('twodsix', 'hideUntrainedSkills') && value < 0);
  });

  Handlebars.registerHelper('twodsix_burstModes', (weapon) => {
    // Parse rates of fire, and ignore the 1
    const modes = weapon.rateOfFire.split('-');
    modes.shift();
    return modes;
  });

  Handlebars.registerHelper('twodsix_useCEAutofireRules', () => {
    return (game.settings.get('twodsix', 'autofireRulesUsed') == TWODSIX.VARIANTS.CE);
  });

  Handlebars.registerHelper('twodsix_useCELAutofireRules', (weapon) => {
    return ((game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.VARIANTS.CEL) && (weapon.rateOfFire > 1));
  });

  Handlebars.registerHelper('twodsix_burstAttackDM', (burstSize) => {
    switch(burstSize) {
      case '1':
        return 0;
      case '3':
      case '4':
        return 1;
      case '10':
        return 2;
      case '20':
        return 3;
      case '100':
        return 4;
      default:
        return 0;
    }
  });

  Handlebars.registerHelper('twodsix_burstBonusDamage', (burstSize) => {
    switch(burstSize) {
      case '1':
        return '0';
      case '3':
        return '1';
      case '4':
        return '1d6';
      case '10':
        return '2d6';
      case '20':
        return '3d6';
      case '100':
        return '4d6';
      default:
        return '0';
    }
  });

  //From https://discord.com/channels/732325252788387980/732328233630171188/790507540818690068
  //Not used yet
  Handlebars.registerHelper("iff", function (v1, operator, v2, options) {
    switch (operator) {
      case '==':
        return (v1 == v2) ? options.fn(this) : options.inverse(this);
      case '===':
        return (v1 === v2) ? options.fn(this) : options.inverse(this);
      case '!=':
        return (v1 != v2) ? options.fn(this) : options.inverse(this);
      case '!==':
        return (v1 !== v2) ? options.fn(this) : options.inverse(this);
      case '<':
        return (v1 < v2) ? options.fn(this) : options.inverse(this);
      case '<=':
        return (v1 <= v2) ? options.fn(this) : options.inverse(this);
      case '>':
        return (v1 > v2) ? options.fn(this) : options.inverse(this);
      case '>=':
        return (v1 >= v2) ? options.fn(this) : options.inverse(this);
      case '&&':
        return (v1 && v2) ? options.fn(this) : options.inverse(this);
      case '||':
        return (v1 || v2) ? options.fn(this) : options.inverse(this);
      default:
        return options.inverse(this);
    }
  });

}
