import { fields, requiredInteger } from '../commonSchemaUtils.js';
import { GearData } from './gear-data.js';

export class AugmentData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.auglocation = new fields.StringField({required: true, blank: false, initial: "None"});
    schema.bonus = new fields.StringField({required: true, blank: true, initial: "stat increase"});
    schema.buildPoints = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}
