import {advantageDisadvantageTerm} from './i18n';
import {calcModFor, getKeyByValue} from './utils/sheetUtils';
import {TWODSIX} from './config';
import TwodsixItem from './entities/TwodsixItem';
import {getGame, getUi} from './utils/utils';

export default function registerHandlebarsHelpers(): void {

  let showedError = false;

  Handlebars.registerHelper('twodsix_advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

  Handlebars.registerHelper('twodsix_capitalize', (str) => {
    if (typeof str !== 'string') { // this was === before, but seems like it should have been !==
      return '';
    } else {
      const thing: string = str;
      return str.charAt(0).toUpperCase() + (thing.length > 1 ? thing.slice(1) : '');
    }
  });

  Handlebars.registerHelper('twodsix_limitLength', function (a, b) {
    return a.length > b ? '(...)' : a;
  });

  Handlebars.registerHelper('twodsix_skillCharacteristic', (actor, characteristic) => {
    const actorData = actor.data;
    const characteristicElement = actorData.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    if (characteristicElement) {
      const mod: number = calcModFor(characteristicElement.current);
      return getGame().i18n.localize('TWODSIX.Items.Skills.' + characteristic) + '(' + (mod < 0 ? '' : '+') + mod + ')';
    } else if ('NONE' === characteristic) {
      return getGame().i18n.localize('TWODSIX.Items.Skills.NONE');
    } else {
      if (!showedError) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore If ui is null, we're not in foundry. So, meh
        getUi().notifications?.error(getGame().i18n.localize('TWODSIX.Handlebars.CantShowCharacteristic'));
        showedError = true;
      }
      return 'XXX';
    }
  });

  Handlebars.registerHelper('twodsix_localizeConsumable', (type) => {
    return getGame().i18n.localize(`TWODSIX.Items.Consumable.Types.${type}`);
  });

  Handlebars.registerHelper('twodsix_refillText', (subtype, quantity) => {
    const refillWord = ['magazine', 'power_cell'].includes(subtype) ? 'Reload' : 'Refill';
    return `${getGame().i18n.localize(`TWODSIX.Actor.Items.${refillWord}`)} (${quantity - 1})`;
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
    if (getGame().settings.get('twodsix', 'invertSkillRollShiftClick')) {
      return getGame().i18n.localize('TWODSIX.Actor.Skills.InvertedSkillRollTooltip');
    } else {
      return getGame().i18n.localize('TWODSIX.Actor.Skills.SkillRollTooltip');
    }
  });

  Handlebars.registerHelper('twodsix_hideUntrainedSkills', (value) => {
    return value && (getGame().settings.get('twodsix', 'hideUntrainedSkills') && value < 0);
  });

  Handlebars.registerHelper('twodsix_burstModes', (weapon) => {
    // Parse rates of fire, and ignore the first number (usually 1, but can be 0, which means no single fire)
    const modes = weapon.rateOfFire.split(/[-/]/);
    modes.shift();
    return modes;
  });

  Handlebars.registerHelper('twodsix_useCEAutofireRules', () => {
    return (getGame().settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key);
  });

  Handlebars.registerHelper('twodsix_useCELAutofireRules', (weapon) => {
    return ((getGame().settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) && (weapon.rateOfFire > 1));
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
    return skill != null && !skill.getFlag('twodsix', 'untrainedSkill') && skill.type === 'skills';
  });

  Handlebars.registerHelper('each_sort_by_name', (array, options) => {
    const sortedArray = array?.slice(0).sort((a: TwodsixItem, b: TwodsixItem) => {
      if (a.name === null || b.name === null) {
        throw new Error(`Item ${a}or ${b} somehow does not have a name?`);
      }
      const aName = a.name.toLowerCase(), bName = b.name.toLowerCase();
      return (aName > bName) ? 1 : ((bName > aName) ? -1 : 0);
    });
    return Handlebars.helpers.each(sortedArray, options);
  });

  // Handy for debugging
  Handlebars.registerHelper('debug', function (context) {
    console.log(context);
    return JSON.stringify(context);
  });

  //From https://discord.com/channels/732325252788387980/732328233630171188/790507540818690068
  Handlebars.registerHelper('iff', function (v1, operator, v2, options) {
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
