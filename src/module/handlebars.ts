import {advantageDisadvantageTerm} from "./i18n";
import {calcModFor, getKeyByValue} from "./utils/sheetUtils";
import {TWODSIX} from "./config";
import TwodsixItem from "./entities/TwodsixItem";

export default function registerHandlebarsHelpers():void {

  let showedError = false;

  Handlebars.registerHelper('twodsix_advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

  Handlebars.registerHelper('twodsix_capitalize', (str) => {
    return typeof str === 'string' ? '' : str.charAt(0).toUpperCase() + str.slice(1);
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

  Handlebars.registerHelper('twodsix_invertSkillRollShiftClick', () => {
    if (game.settings.get('twodsix', 'invertSkillRollShiftClick')) {
      return game.i18n.localize("TWODSIX.Actor.Skills.InvertedSkillRollTooltip");
    } else {
      return game.i18n.localize("TWODSIX.Actor.Skills.SkillRollTooltip");
    }
  });

  Handlebars.registerHelper('twodsix_hideUntrainedSkills', (value) => {
    return value && (game.settings.get('twodsix', 'hideUntrainedSkills') && value < 0);
  });

  Handlebars.registerHelper('twodsix_burstModes', (weapon) => {
    // Parse rates of fire, and ignore the first number (usually 1, but can be 0, which means no single fire)
    const modes = weapon.rateOfFire.split(/[-/]/);
    modes.shift();
    return modes;
  });

  Handlebars.registerHelper('twodsix_useCEAutofireRules', () => {
    return (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key);
  });

  Handlebars.registerHelper('twodsix_useCELAutofireRules', (weapon) => {
    return ((game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) && (weapon.rateOfFire > 1));
  });

  Handlebars.registerHelper('twodsix_burstAttackDM', (burstSize:string) => {
    const number = Number(burstSize);
    return TwodsixItem.burstAttackDM(number);
  });

  Handlebars.registerHelper('twodsix_burstBonusDamage', (burstSize) => {
    const number = Number(burstSize);
    return TwodsixItem.burstBonusDamage(number);
  });

  Handlebars.registerHelper('twodsix_filterSkills', (skill) => {
    return skill!=null && !skill.flags?.twodsix?.untrainedSkill && skill.type === "skills";
  });

  // Handy for debugging
  Handlebars.registerHelper('debug', function(context) {
    console.log(context);
    return JSON.stringify(context);
  });

  //From https://discord.com/channels/732325252788387980/732328233630171188/790507540818690068
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
