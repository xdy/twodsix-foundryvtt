import { fields, makeSecondaryArmorField, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixActorBaseData } from './character-base.js';

export class RobotData extends TwodsixActorBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.size = new fields.StringField({...requiredBlankString});
    schema.locomotionType = new fields.StringField({...requiredBlankString});
    schema.locomotionType = new fields.StringField({...requiredBlankString});
    schema.price = new fields.StringField({...requiredBlankString});
    schema.chassis = new fields.StringField({...requiredBlankString});
    schema.techLevel = new fields.NumberField({...requiredInteger, initial: 0});
    schema.operationalTime = new fields.StringField({...requiredBlankString});
    schema.secondaryArmor = makeSecondaryArmorField();
    schema.maxBuildPoints = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}
