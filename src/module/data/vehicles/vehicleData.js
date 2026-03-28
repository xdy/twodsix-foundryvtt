import { fields, makeResourceField, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixVehicleBaseData } from './vehicles-base.js';

export class VehicleData extends TwodsixVehicleBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.cargoList = new fields.StringField({...requiredBlankString});
    schema.cargoCapacity = new fields.StringField({...requiredBlankString});
    schema.cost = new fields.StringField({...requiredBlankString});
    schema.crew = new fields.SchemaField({
      operators: new fields.StringField({...requiredBlankString}),
      passengers: new fields.StringField({...requiredBlankString})
    });
    schema.damageStats = new fields.SchemaField({
      armor: makeResourceField(0, 0),
      armorLabel: new fields.StringField({...requiredBlankString}),
      hull: makeResourceField(0, 0),
      structure: makeResourceField(0, 0),
      threshold: new fields.SchemaField({
        regular: new fields.NumberField({...requiredInteger, initial: 0}),
        critical: new fields.NumberField({...requiredInteger, initial: 0})
      }),
      detailedArmor: new fields.SchemaField({
        front: makeResourceField(0, 0),
        rear: makeResourceField(0, 0),
        sides: makeResourceField(0, 0)
      })
    });
    schema.features = new fields.StringField({...requiredBlankString});
    schema.maneuver = new fields.SchemaField({
      speed: new fields.StringField({required: true, blank: true, initial: "0"}),
      speedUnits: new fields.StringField({required: true, blank: true, initial: "km/h"}),
      range: new fields.StringField({required: true, blank: true, initial: "0"}),
      rangeUnits: new fields.StringField({required: true, blank: true, initial: "km"}),
      agility: new fields.StringField({...requiredBlankString})
    });
    schema.skillToOperate = new fields.StringField({...requiredBlankString});
    schema.systemStatus = new fields.SchemaField({
      cargo: new fields.StringField({required: true, blank: false, initial: "operational"}),
      cockpit: new fields.StringField({required: true, blank: false, initial: "operational"}),
      computers: new fields.StringField({required: true, blank: false, initial: "operational"}),
      electronics: new fields.StringField({required: true, blank: false, initial: "operational"}),
      limbs: new fields.StringField({required: true, blank: false, initial: "operational"}),
      propulsion: new fields.StringField({required: true, blank: false, initial: "operational"}),
      powerPlant: new fields.StringField({required: true, blank: false, initial: "operational"}),
      sensors: new fields.StringField({required: true, blank: false, initial: "operational"})
    });
    schema.weaponsType = new fields.StringField({...requiredBlankString});
    schema.openVehicle = new fields.BooleanField({required: true, initial: false});
    schema.traits = new fields.StringField({...requiredBlankString});
    schema.weight = new fields.StringField({...requiredBlankString});
    schema.shippingSize = new fields.StringField({...requiredBlankString});
    schema.spaces = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0}),
      max: new fields.NumberField({...requiredInteger, initial: 0})
    });
    return schema;
  }
}
