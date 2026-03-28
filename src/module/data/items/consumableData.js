import { fields, migrateNumberToString, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { GearData } from './gear-data.js';
import { makeTargetTemplate } from './item-base.js';

export class ConsumableData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.currentCount = new fields.NumberField({...requiredInteger, initial: 1});
    schema.max = new fields.NumberField({...requiredInteger, initial: 0});
    schema.subtype = new fields.StringField({required: true, blank: false, initial: "other"});
    schema.armorPiercing = new fields.StringField({required: true, blank: false, initial: "0"});
    schema.bonusDamage = new fields.StringField({...requiredBlankString});
    schema.ammoRangeModifier = new fields.StringField({required: true, blank: false, initial: "0"});
    schema.isAttachment = new fields.BooleanField({required: true, initial: false});
    schema.bandwidth = new fields.NumberField({...requiredInteger, initial: 0});
    schema.softwareActive = new fields.BooleanField({required: true, initial: true});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "NONE"});
    schema.parentName = new fields.StringField({...requiredBlankString});
    schema.parentType = new fields.StringField({...requiredBlankString});
    schema.target = makeTargetTemplate();
    return schema;
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("ammoRangeModifier" in source) {
      if (source.ammoRangeModifier === "") {
        source.ammoRangeModifier = "0";
      }
    }
    if ("armorPiercing" in source) {
      if (typeof source.armorPiercing !== 'string') {
        migrateNumberToString(source, 'armorPiercing');
      }
    }
    return super.migrateData(source);
  }
}
