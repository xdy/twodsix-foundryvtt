import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TraitData } from './traitData.js';

export class SkillData extends TraitData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.value = new fields.NumberField({...requiredInteger, initial: -3});
    schema.characteristic = new fields.StringField({required: true, blank: false, initial: "NONE"});
    schema.difficulty = new fields.StringField({required: true, blank: false, initial: "Average"});
    schema.rolltype = new fields.StringField({required: true, blank: false, initial: "Normal"}); ///Probably should be rollType
    schema.trainingNotes = new fields.StringField({...requiredBlankString});
    schema.groupLabel = new fields.StringField({...requiredBlankString});
    return schema;
  }
}
