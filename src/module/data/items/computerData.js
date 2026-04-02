import { fields, requiredInteger } from '../commonSchemaUtils.js';
import { GearData } from './gear-data.js';

export class ComputerData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.processingPower = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}
