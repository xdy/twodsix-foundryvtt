import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';

export class TwodsixCombatData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.currentPhase = new fields.StringField({...requiredBlankString });
    schema.phaseIndex = new fields.NumberField({...requiredInteger, initial: 0});
    schema.isSpaceCombat = new fields.BooleanField({ required: true, initial: false});
    return schema;
  }
}
