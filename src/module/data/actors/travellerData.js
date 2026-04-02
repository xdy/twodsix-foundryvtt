import {
  fields,
  makeValueField,
  migrateStringToNumber,
  requiredBlankString,
  requiredInteger
} from '../commonSchemaUtils.js';
import { TwodsixActorBaseData } from './character-base.js';

export class TravellerData extends TwodsixActorBaseData {
  static hasEncumbranceTracking = true;

  static defineSchema() {
    const schema = super.defineSchema();

    // Override primaryArmor to add persisted:false `base` sub-field used in _prepareActorDerivedData
    schema.primaryArmor = new fields.SchemaField({
      value: new fields.NumberField({required: true, integer: false, initial: 0}),
      base: new fields.NumberField({required: true, integer: false, initial: 0}, {persisted: false})
    });
    schema.homeWorld = new fields.StringField({...requiredBlankString});
    schema.nationality = new fields.StringField({...requiredBlankString});
    schema.primaryLanguage = new fields.StringField({...requiredBlankString});
    schema.species = new fields.StringField({...requiredBlankString});
    schema.age = new fields.SchemaField({
      value: new fields.NumberField({required: true, nullable: true, integer: false, initial: 18}),
      min: new fields.NumberField({required: true, nullable: true, integer: false, initial: 0})
    });
    schema.gender = new fields.StringField({...requiredBlankString});
    schema.heroPoints = new fields.NumberField({...requiredInteger, initial: 2});
    schema.contacts = new fields.HTMLField({...requiredBlankString});
    /*schema.allies = new fields.HTMLField({...requiredBlankString});
    schema.enemies = new fields.HTMLField({...requiredBlankString});*/
    schema.secondaryArmor = makeValueField();

    schema.finances = new fields.SchemaField({
      cash: new fields.StringField({required: true, blank: false, initial: "0"}),
      pension: new fields.StringField({required: true, blank: false, initial: "0"}),
      payments: new fields.StringField({required: true, blank: false, initial: "0"}),
      debt: new fields.StringField({required: true, blank: false, initial: "0"}),
      livingCosts: new fields.StringField({required: true, blank: false, initial: "0"}),
      'financial-notes': new fields.StringField({...requiredBlankString})
    });
    schema.financeValues = new fields.SchemaField({
      cash: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      pension: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      payment: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      debt: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      livingCosts: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0})
    });

    schema.hideStoredItems = new fields.SchemaField({
      weapon: new fields.BooleanField({required: true, initial: false}),
      armor: new fields.BooleanField({required: true, initial: false}),
      augment: new fields.BooleanField({required: true, initial: false}),
      equipment: new fields.BooleanField({required: true, initial: false}),
      consumable: new fields.BooleanField({required: true, initial: false}),
      attachment: new fields.BooleanField({required: true, initial: false}),
      junk: new fields.BooleanField({required: true, initial: false})
    });

    schema.experience = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0}),
      totalEarned: new fields.NumberField({...requiredInteger, initial: 0})
    });

    schema.xpNotes = new fields.HTMLField({...requiredBlankString});
    schema.displaySkillGroup = new fields.ObjectField({required: true, initial: {}});

    // Computed armor fields — derived in TravellerActor._prepareActorDerivedData, never persisted
    schema.layersWorn = new fields.NumberField({...requiredInteger, initial: 0}, {persisted: false});
    schema.wearingNonstackable = new fields.BooleanField({required: true, initial: false}, {persisted: false});
    schema.reflectOn = new fields.BooleanField({required: true, initial: false}, {persisted: false});
    schema.protectionTypes = new fields.StringField({...requiredBlankString}, {persisted: false});
    schema.totalArmor = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}, {persisted: false});

    return schema;
  }

  // ── Finance field helpers ────────────────────────────────────────────────────

  /**
   * Lookup the first letter of units and determine magnitude.
   * @param {string} units - The units string (e.g., 'M', 'k', 'G').
   * @returns {number} - The numeric multiplier for the units.
   */
  static getMultiplier(units) {
    switch (units[0]) {
      case 'G':
        return 1e+9;
      case 'M':
        return 1e+6;
      case 'k':
      case 'K':
        return 1e+3;
      default:
        return 1;
    }
  }

  /**
   * Parse a finance text field into separate value and units.
   * @param {string} financeString - The finance string to parse.
   * @returns {Record<string, any> | undefined} - Object with keys num and units, or undefined if parsing fails.
   */
  static getParsedFinanceText(financeString) {
    const re = new RegExp(/^(?<pre>\D*?)(?<num>[0-9,.\-+]*)(?<sp>\s*)(?<units>.*?)$/);
    const parsedResult = re.exec(financeString);
    return parsedResult?.groups;
  }

  /**
   * Convert a number to a localized string with optional units.
   * @param {number} newValue - The new value to format.
   * @param {string} [units] - Optional units for the number, e.g. 'M' or 'k'.
   * @returns {string} - The localized number as a string, with units if provided.
   */
  static convertNumberToFormattedText(newValue, units) {
    const numberDigits = newValue === 0 ? 1 : Math.floor(Math.log10(Math.abs(newValue))) + 1;
    if (units) {
      newValue /= TravellerData.getMultiplier(units);
    }
    return ''.concat(
      newValue.toLocaleString(game.i18n.lang, {minimumSignificantDigits: numberDigits}),
      (units ? ' ' + units : '')
    );
  }

  // ── Migration ────────────────────────────────────────────────────────────────

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("age" in source) {
      migrateStringToNumber(source.age, "value");
    }
    if ("finances" in source) {
      const fin = source.finances;
      if (fin && typeof fin === 'object') {
        for (const [key, value] of Object.entries(fin)) {
          if (value === "" || value === null || value === undefined) {
            source.finances[key] = "0";
          }
        }
      }
    }
    return super.migrateData(source);
  }
}

