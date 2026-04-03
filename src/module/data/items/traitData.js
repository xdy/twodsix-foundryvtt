import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

export class TraitData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.value = new fields.NumberField({...requiredInteger, initial: 0});
    schema.shortdescr = new fields.StringField({...requiredBlankString});
    schema.subtype = new fields.StringField({...requiredBlankString});  //Needed?
    schema.prereq = new fields.StringField({...requiredBlankString});
    schema.key = new fields.StringField({required: true, blank: false, initial: "key"}); //Needed?
    return schema;
  }
}
