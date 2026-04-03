import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

export class ShipPositionData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.name = new fields.StringField({...requiredBlankString});
    schema.icon = new fields.StringField({...requiredBlankString});
    schema.actions = new fields.ObjectField({required: true, initial: {}});
    schema.order = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}
