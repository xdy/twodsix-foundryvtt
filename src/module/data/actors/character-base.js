import { TWODSIX } from '../../config.js';
import { calcModFor } from '../../utils/sheetUtils.js';
import { getCharShortName } from '../../utils/utils.js';
import {
  fields,
  makeResourceField,
  makeValueField,
  migrateStringToStringArray,
  requiredBlankString,
  requiredInteger
} from '../commonSchemaUtils.js';

/** @typedef {import("@common/abstract/data.mjs").DataSchema} DataSchema */

export class TwodsixActorBaseData extends foundry.abstract.TypeDataModel {
  static hasEncumbranceTracking = false;

  /**
   * @returns {DataSchema}
   */
  static defineSchema() {
    const schema = {};
    schema.name = new fields.StringField({...requiredBlankString});
    /* Characteristic Data */
    schema.characteristics = new fields.SchemaField({
      strength: makeCharacteristicField("strength", "STR"),
      dexterity: makeCharacteristicField("dexterity", "DEX"),
      endurance: makeCharacteristicField("endurance", "END"),
      intelligence: makeCharacteristicField("intelligence", "INT"),
      education: makeCharacteristicField("education", "EDU"),
      socialStanding: makeCharacteristicField("socialStanding", "SOC"),
      psionicStrength: makeCharacteristicField("psionicStrength", "PSI"),
      stamina: makeCharacteristicField("stamina", "STA"),
      lifeblood: makeCharacteristicField("lifeblood", "LFB"),
      alternative1: makeCharacteristicField("alternative1", "ALT1"),
      alternative2: makeCharacteristicField("alternative2", "ALT2"),
      alternative3: makeCharacteristicField("alternative3", "ALT3")
    });
    schema.characteristicEdit = new fields.BooleanField();

    /* Armor Data */
    schema.primaryArmor = makeValueField();
    schema.radiationProtection = makeValueField();
    schema.armorType = new fields.StringField({required: true, blank: false, initial: "nothing"});
    schema.armorDM = new fields.NumberField({...requiredInteger, initial: 0});

    /* Conditions Data */
    schema.conditions = new fields.SchemaField({
      woundedEffect: new fields.NumberField({...requiredInteger, initial: 0}),
      encumberedEffect: new fields.NumberField({...requiredInteger, initial: 0})
    });

    /* Movement Data */
    const numberConfig = {required: true, nullable: true, min: 0, step: 0.1, initial: null};
    schema.movement = new fields.SchemaField({
      burrow: new fields.NumberField({...numberConfig, label: TWODSIX.MovementType.burrow}),
      climb: new fields.NumberField({...numberConfig, label: TWODSIX.MovementType.climb}),
      fly: new fields.NumberField({...numberConfig, label: TWODSIX.MovementType.fly}),
      swim: new fields.NumberField({...numberConfig, label: TWODSIX.MovementType.swim}),
      walk: new fields.NumberField({...numberConfig, label: TWODSIX.MovementType.walk}),
      units: new fields.StringField({
        required: true,
        nullable: true,
        blank: false,
        initial: "m",
        label: "TWODSIX.Actor.Movement.MovementUnits"
      }),
      hover: new fields.BooleanField({required: true, initial: false, label: TWODSIX.MovementType.hover}),
    });

    /* References */
    schema.docReference = new fields.ArrayField(new fields.StringField({...requiredBlankString}), {initial: [""]});
    schema.pdfReference = new fields.SchemaField({
      type: new fields.StringField({...requiredBlankString}),
      href: new fields.StringField({...requiredBlankString}),
      label: new fields.StringField({...requiredBlankString})
    });

    /* Radiation Dose Data */
    schema.radiationDose = makeResourceField(0, 0);

    /* Encumbrance Data */
    schema.encumbrance = new fields.SchemaField({
      value: new fields.NumberField({required: true, integer: false, initial: 0}),
      max: new fields.NumberField({required: true, integer: false, initial: 0}),
      min: new fields.NumberField({required: true, integer: false, initial: 0}),
      offset: new fields.NumberField({required: true, integer: false, initial: 0})
    });

    /* Hits Data */
    schema.hits = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 21}),
      max: new fields.NumberField({...requiredInteger, initial: 21}),
      min: new fields.NumberField({...requiredInteger, initial: 0}),
      lastDelta: new fields.NumberField({...requiredInteger, initial: 0})
    });

    /* Untrained Skill link */
    schema.untrainedSkill = new fields.StringField({...requiredBlankString});

    /* Descriptions */
    schema.description = new fields.HTMLField({...requiredBlankString});
    schema.notes = new fields.HTMLField({...requiredBlankString});
    schema.bio = new fields.HTMLField({...requiredBlankString});

    return schema;
  }

  /**
   * Compute derived characteristic fields (current, mod, displayShortLabel) from persisted values.
   * @override
   */
  prepareDerivedData() {
    if (!this.characteristics) {
      return;
    }
    for (const characteristic of Object.values(this.characteristics)) {
      characteristic.current = characteristic.value - characteristic.damage;
      characteristic.mod = calcModFor(characteristic.current);
      if (characteristic.displayShortLabel === "") {
        characteristic.displayShortLabel = getCharShortName(characteristic.shortLabel);
      }
    }
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("docReference" in source) {
      migrateStringToStringArray(source, "docReference");
      if (source.docReference.length === 0) {
        source.docReference = [""];
      }
    }
    return super.migrateData(source);
  }
}

/**
 * Produce the schema field for a characteristic
 * @param {string} key  Characteristic key.
 * @param {string} shortName Characteristic short label
 * @param {object} schemaOptions  Options passed to the outer schema.
 * @returns {foundry.data.fields.SchemaField}
 */
export function makeCharacteristicField(key, shortName, schemaOptions = {}) {
  return new fields.SchemaField({
    key: new fields.StringField({required: true, blank: true, initial: key}),
    value: new fields.NumberField({...requiredInteger, initial: 7, min: 0}),
    current: new fields.NumberField({...requiredInteger, initial: 7, min: 0}, {persisted: false}),
    damage: new fields.NumberField({...requiredInteger, initial: 0, min: 0}),
    mod: new fields.NumberField({...requiredInteger, initial: 0}, {persisted: false}),
    label: new fields.StringField({required: true, blank: true, initial: key.capitalize()}),
    shortLabel: new fields.StringField({required: true, blank: true, initial: shortName}),
    displayShortLabel: new fields.StringField({required: true, blank: true})
  }, schemaOptions);
}
