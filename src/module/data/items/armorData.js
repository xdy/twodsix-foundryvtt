import { fields, makeValueField, requiredInteger } from '../commonSchemaUtils.js';
import { GearData } from './gear-data.js';

export class ArmorData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.armor = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.armorDM = new fields.NumberField({...requiredInteger, initial: 0});
    schema.secondaryArmor = new fields.SchemaField({
      value: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      protectionTypes: new fields.ArrayField(new fields.StringField({blank: false}))
    });
    schema.radiationProtection = makeValueField(0);
    schema.isPowered = new fields.BooleanField({required: true, initial: false});
    schema.nonstackable = new fields.BooleanField({required: true, initial: false});
    schema.armorType = new fields.StringField({required: true, blank: false, initial: "nothing"});
    return schema;
  }
}
