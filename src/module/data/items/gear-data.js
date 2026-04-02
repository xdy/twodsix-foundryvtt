import { fields, migrateStringToNumber, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

export class GearData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.techLevel = new fields.NumberField({...requiredInteger, initial: 0});
    schema.shortdescr = new fields.StringField({...requiredBlankString});
    schema.quantity = new fields.NumberField({...requiredInteger, initial: 1});
    schema.weight = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.price = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.traits = new fields.ArrayField(new fields.StringField({blank: false}));
    schema.consumables = new fields.ArrayField(new fields.StringField({blank: false}));
    schema.useConsumableForAttack = new fields.StringField({...requiredBlankString});
    schema.skillModifier = new fields.NumberField({...requiredInteger, initial: 0});
    schema.skill = new fields.StringField({...requiredBlankString});
    schema.associatedSkillName = new fields.StringField({...requiredBlankString});
    schema.equipped = new fields.StringField({required: true, blank: false, initial: "backpack"});
    return schema;
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("weight" in source) {
      migrateStringToNumber(source, "weight");
    }
    if ("price" in source) {
      migrateStringToNumber(source, "price");
    }
    return super.migrateData(source);
  }
}
