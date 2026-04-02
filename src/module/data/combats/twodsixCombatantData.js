import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';

export class TwodsixCombatantData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.spacePhase = new fields.StringField({ ...requiredBlankString });
    schema.minorActionsUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.significantActionsUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.reactionsUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.reactionsAvailable = new fields.NumberField({...requiredInteger, initial: 0});
    schema.thrustUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.thrustAvailable = new fields.NumberField({...requiredInteger, initial: 0});
    schema.hasty = new fields.BooleanField({ required: true, initial: false});
    return schema;
  }
}
