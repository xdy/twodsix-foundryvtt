import { fields, makeResourceField, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixVehicleBaseData } from './vehicles-base.js';

export class SpaceObjectData extends TwodsixVehicleBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.features = new fields.StringField({...requiredBlankString});
    schema.count = makeResourceField(0, 0);
    schema.damage = new fields.StringField({required: true, blank: true, initial: "3D6"});
    schema.thrust = new fields.NumberField({...requiredInteger, initial: 0});
    schema.roundsActive = new fields.NumberField({...requiredInteger, initial: 0});

    return schema;
  }
}
