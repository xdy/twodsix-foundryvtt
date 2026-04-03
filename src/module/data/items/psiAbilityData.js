import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { makeTargetTemplate } from './item-base.js';
import { TraitData } from './traitData.js';

export class PsiAbilityData extends TraitData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.target = makeTargetTemplate();
    schema.duration = new fields.StringField({...requiredBlankString});
    schema.associatedSkillName = new fields.StringField({...requiredBlankString});
    schema.skill = new fields.StringField({...requiredBlankString});
    schema.range = new fields.StringField({...requiredBlankString});
    schema.rangeBand = new fields.StringField({required: true, blank: false, initial: "none"});
    schema.damage = new fields.StringField({...requiredBlankString});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "psionic"});
    schema.psiCost = new fields.NumberField({...requiredInteger, initial: 0});
    schema.difficulty = new fields.StringField({required: true, blank: false, initial: "Average"});
    schema.skillModifier = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}
