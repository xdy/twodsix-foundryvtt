import { fields, requiredBlankString } from '../commonSchemaUtils.js';
import { makeTargetTemplate } from './item-base.js';
import { TraitData } from './traitData.js';

export class SpellData extends TraitData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.target = makeTargetTemplate();
    schema.circle = new fields.StringField({...requiredBlankString});
    schema.duration = new fields.StringField({...requiredBlankString});
    schema.associatedSkillName = new fields.StringField({...requiredBlankString});
    schema.damage = new fields.StringField({...requiredBlankString});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "NONE"});
    return schema;
  }
}
