// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/*import { advantageDisadvantageTerm } from "./i18n";*/
import { getKeyByValue} from "./utils/utils";
import { TWODSIX } from "./config";
import TwodsixItem from "./entities/TwodsixItem";
import TwodsixActor, { getPower, getWeight } from "./entities/TwodsixActor";
import { getCharacteristicList } from "./utils/TwodsixRollSettings";
import { simplifySkillName } from "./utils/utils";

export default function registerHandlebarsHelpers(): void {

  let showedError = false;

  /*Handlebars.registerHelper('twodsix_advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

  Handlebars.registerHelper('twodsix_difficultiesAsTargetNumber', () => {
    return game.settings.get('twodsix', 'difficultiesAsTargetNumber');
  });*/

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

  Handlebars.registerHelper('twodsix_limitLength', function (inStr:string, len: number) {
    if (!inStr) {
      return '';
    } else {
      return inStr.length > len ? '(...)' : inStr;
    }
  });

  Handlebars.registerHelper('twodsix_skillCharacteristic', (actor, characteristic) => {
    const characteristicElement = actor.system.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic)];
    if (characteristicElement) {
      //const mod: number = calcModFor(characteristicElement.current);
      const mod: number = characteristicElement.mod;
      const abbreviatedCharName: string = characteristicElement.displayShortLabel;
      return abbreviatedCharName + "(" + (mod < 0 ? "" : "+") + mod + ")";
    } else if ('NONE' === characteristic) {
      return game.i18n.localize("TWODSIX.Items.Skills.NONE");
    } else {
      if (!showedError) {
        ui.notifications.error("TWODSIX.Handlebars.CantShowCharacteristic", {localize: true});
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

  Handlebars.registerHelper('twodsix_skillTotal', (actor, skillItem) => {
    const characteristicElement = actor.system.characteristics[getKeyByValue(TWODSIX.CHARACTERISTICS, skillItem.system.characteristic)];
    let adjValue = actor.system.skills[simplifySkillName(skillItem.name)] ?? skillItem.system.value;

    /* only modify if hideUntrained is false and skill value is untrained (-3) */
    if (adjValue === CONFIG.Item.dataModels.skills.schema.getInitialValue().value && !game.settings.get("twodsix", "hideUntrainedSkills")) {
      adjValue = actor.items.find((i) => i._id === actor.system.untrainedSkill).system.value;
    }

    if (characteristicElement) {
      if (!characteristicElement.current) {
        characteristicElement.current = characteristicElement.value - characteristicElement.damage;
      }

      //const mod = calcModFor(characteristicElement.current);
      const mod = characteristicElement.mod;
      return Number(adjValue) + mod;
    } else {
      return adjValue;
    }
  });

  Handlebars.registerHelper('twodsix_adjustedSkillValue', (actor, skillItem) => {
    const adjValue = actor.system.skills[simplifySkillName(skillItem.name)];
    return (adjValue !== skillItem.system.value ? adjValue : `&#8212;`);
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

  Handlebars.registerHelper('twodsix_burstModes', (weapon: TwodsixItem) => {
    // Parse rates of fire, and ignore the first number (usually 1, but can be 0, which means no single fire)
    const modes = (weapon.system.rateOfFire ?? "").split(/[-/]/);
    modes.shift();
    return modes;
  });

  Handlebars.registerHelper('twodsix_useCELAuto', (weapon: TwodsixItem) => {
    return (parseInt(weapon.system.rateOfFire) > 1 || (weapon.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')));
  });

  Handlebars.registerHelper('twodsix_useCUAuto', (weapon: TwodsixItem) => {
    return parseInt(weapon.system.rateOfFire) > 1;
  });

  Handlebars.registerHelper('twodsix_useCTAuto', (weapon: TwodsixItem) => {
    const modes = (weapon.system.rateOfFire ?? "").split(/[-/]/);
    return (modes.length > 1);
  });

  Handlebars.registerHelper('twodsix_useCTSingle', (weapon: TwodsixItem) => {
    const modes = (weapon.system.rateOfFire ?? "").split(/[-/]/);
    return Number(modes[0]) === 1;
  });

  Handlebars.registerHelper('twodsix_CTBurstSize', (weapon: TwodsixItem) => {
    const modes = (weapon.system.rateOfFire ?? "").split(/[-/]/);
    if (modes.length > 1) {
      return Number(modes[1]);
    } else {
      return 1;
    }
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

  Handlebars.registerHelper('alternativeShort3', () => {
    return game.settings.get('twodsix', 'alternativeShort3');
  });

  Handlebars.registerHelper('skillName', (skillName) => {
    return simplifySkillName(skillName);
  });

  Handlebars.registerHelper('replace', (text, key, value) => {
    return text.replaceAll(key, value);
  });

  /**
   * Handlebars helper to return a Font Awesome icon string based on the component type.
   * @param {string} componentType - The type of the component.
   * @returns {string} - Font Awesome icon string reference/id.
   */
  Handlebars.registerHelper('twodsix_getComponentIcon', (componentType: string): string => {
    const iconMap: Record<string, string> = {
      accomodations: "fa-solid fa-bed",
      armament: "fa-solid fa-crosshairs",
      armor: "fa-solid fa-grip-vertical",
      bridge: "fa-solid fa-person-seat",
      cargo: "fa-solid fa-boxes-stacked",
      computer: "fa-solid fa-computer",
      dock: "fa-solid fa-arrow-right-arrow-left",
      drive: "fa-solid fa-up-down-left-right",
      drone: "fa-solid fa-satellite",
      electronics: "fa-solid fa-microchip",
      fuel: "fa-solid fa-gas-pump",
      hull: "fa-solid fa-rocket",
      mount: "fa-regular fa-circle-dot",
      otherExternal: "fa-solid fa-right-from-bracket",
      otherInternal: "fa-solid fa-right-to-bracket",
      power: "fa-solid fa-atom",
      sensor: "fa-solid fa-solar-panel",
      shield: "fa-solid fa-shield-halved",
      software: "fa-solid fa-code",
      storage: "fa-solid fa-boxes-stacked",
      vehicle: "fa-solid fa-shuttle-space",
    };

    return iconMap[componentType] || "fa-solid fa-circle-question";
  });

  /**
   * Handlebars helper to return a Font Awesome icon string based on the equipped state.
   * @param {string} equipped - The equipped state.
   * @returns {string} - Font Awesome icon string reference/id.
   */
  Handlebars.registerHelper('twodsix_getEquippedIcon', (equipped: string): string => {
    const equippedIconMap: Record<string, string> = {
      backpack: "fa-solid fa-person-hiking",
      equipped: "fa-solid fa-child-reaching",
      ship: "fa-solid fa-shuttle-space",
      vehicle: "fa-solid fa-truck-plane",
      base: "fa-solid fa-house-user",
    };

    // Return the corresponding icon or a default icon
    return equippedIconMap[equipped] || "fa-solid fa-person-hiking";
  });

  Handlebars.registerHelper('twodsix_showTimeframe', () => {
    return game.settings.get('twodsix', 'showTimeframe');
  });

  Handlebars.registerHelper('twodsix_hideItem', (display:boolean, itemLocation:string) => {
    return (display && (["ship", "vehicle", "base"].includes(itemLocation)));
  });

  Handlebars.registerHelper('twodsix_getProcessingPower', (item:TwodsixItem) => {
    if (!item) {
      return 0;
    } else {
      let bandwidth = 0;
      if (item.system.attachmentData) {
        for (const attch of item.system.attachmentData) {
          if (attch.system.subtype === "software" && attch.system.softwareActive) {
            bandwidth += attch.system.bandwidth;
          }
        }
      }
      return (bandwidth);
    }
  });

  Handlebars.registerHelper('twodsix_die_style', (die:any) => {
    let style = "roll die d6";
    if (die.discarded) {
      style += " discarded";
    }
    if (die.result === 6) {
      style += " max";
    } else if (die.result === 1) {
      style += " min";
    }
    return style;
  });

  Handlebars.registerHelper("concat", (...args) => args.slice(0, args.length - 1).join(''));  //Needed -YES. FVTT baseline concat works differently
  /*** No longer needed ****/
  /*
  Handlebars.registerHelper('each_sort_by_property', (property:string, array:TwodsixItem[], options) => {
    let sortedArray: TwodsixItem[] = [];
    const slice = array?.slice(0);
    if (slice) {
      sortedArray = slice.sort((a, b) => {
        if (a[property] == null) {
          return 1;
        } else {
          if (b[property] == null) {
            return -1;
          } else if (a[property] === b[property]) {
            return 0;
          } else {
            return a[property].toLocaleLowerCase().localeCompare(b[property].toLocaleLowerCase());
          }
        }
      });
    }
    return Handlebars.helpers.each(sortedArray, options);
  });

  Handlebars.registerHelper('each_sort_item', (array, options) => {
    let sortedArray: TwodsixItem[] = [];
    const slice: TwodsixItem[] = <TwodsixItem[]>array?.slice(0);
    if (slice?.length > 0) {
      const sortSetting = ["ship", "vehicle"].includes(slice[0].parent.type)  ? 'allowDragDropOfListsShip' : 'allowDragDropOfListsActor';
      const sortLabel = game.settings.get('twodsix', sortSetting) ? "sort" : "name";
      sortedArray = slice.sort((a, b) => {
        if (a[sortLabel] == null) {
          return 1;
        } else {
          if (b[sortLabel] == null) {
            return -1;
          } else if (a[sortLabel] === b[sortLabel]) {
            return 0;
          } else {
            if (game.settings.get('twodsix', sortSetting)) {
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
*/
  Handlebars.registerHelper('getComponentCost', (item: TwodsixItem) => {
    if (item.system.installedCost) {
      const maxDigits = item.system.installedCost < 0.1 ? 2 : 1;
      return item.system.installedCost.toLocaleString(game.i18n.lang, {minimumFractionDigits: maxDigits, maximumFractionDigits: maxDigits});
    } else {
      return "\u2014";
    }
  });

  Handlebars.registerHelper('getComponentWeight', (item: TwodsixItem) => {
    return getWeight(item).toLocaleString(game.i18n.lang, {minimumFractionDigits: 1, maximumFractionDigits: 1});
  });

  Handlebars.registerHelper('getComponentPrice', (item: TwodsixItem) => {
    return Number(item.system.purchasePrice).toLocaleString(game.i18n.lang, {minimumFractionDigits: 1, maximumFractionDigits: 2}) ;
  });

  Handlebars.registerHelper('getComponentPower', (item: TwodsixItem) => {
    const retValue:string = getPower(item).toLocaleString(game.i18n.lang, {maximumFractionDigits: 1});
    return item.system.generatesPower ? "+" + retValue : retValue;
  });

  Handlebars.registerHelper('getComponentMaxHits', () => {
    return game.settings.get("twodsix", "maxComponentHits");
  });

  Handlebars.registerHelper('getCharacteristicList', (actor: TwodsixActor) => {
    return getCharacteristicList(actor);
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

  Handlebars.registerHelper('makeFireArc', (startAngle: number = 0, endAngle: number = 0) => {
    let wedgeDegrees = (endAngle - startAngle + 360) % 360;
    const minAngle = 10;
    if (wedgeDegrees < minAngle && (startAngle || endAngle)) {
      wedgeDegrees = minAngle;
      startAngle = startAngle < minAngle/2 ? 0 : startAngle - minAngle/2;
    }
    return `background-image: conic-gradient(from ${startAngle}deg, var(--s2d6-pie-color) ${wedgeDegrees}deg, var(--s2d6-pie-background-color) ${wedgeDegrees}deg); border-radius: 50%; border: 1px solid; height: 3ch; width: 3ch;`;
  });

  Handlebars.registerHelper('twodsix_canBePopup', (item: TwodsixItem) => {
    return ["armament", "mount"].includes(item.system.subtype);
  });

  Handlebars.registerHelper('twodsix_canBeEquipped', (item: TwodsixItem) => {
    return ![...TWODSIX.WeightlessItems, "ship_position", "component"].includes(item.type);
  });

  Handlebars.registerHelper('twodsix_getTLString', (itemData: any) => {
    if([...TWODSIX.WeightlessItems, "ship_position"].includes(itemData.type)) {
      return "";
    } else if (itemData.system?.techLevel !== null && itemData.system?.techLevel !== undefined) {
      if(isNaN(itemData.system.techLevel)) {
        return "";
      } else {
        return `(${game.i18n.localize("TWODSIX.Items.Equipment.TL")} ${itemData.system.techLevel})`;
      }
    } else {
      return "";
    }
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
