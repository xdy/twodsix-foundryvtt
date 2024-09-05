// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { makeResourceField } from "./commonSchemaUtils";

const fields = foundry.data.fields;
const requiredInteger = { required: true, nullable: false, integer: true };
const requiredBlankString = { required: true, blank: true, initial: "" };

class TwodsixVehicleBaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.name = new fields.StringField({...requiredBlankString});
    schema.techLevel = new fields.NumberField({ ...requiredInteger, initial: 0 });
    /* References */
    schema.docReference = new fields.StringField({...requiredBlankString});
    schema.pdfReference = new fields.SchemaField({
      type: new fields.StringField({...requiredBlankString}),
      href: new fields.StringField({...requiredBlankString}),
      label: new fields.StringField({...requiredBlankString})
    });

    /* Descriptions */
    schema.description = new fields.HTMLField({...requiredBlankString});
    schema.notes = new fields.HTMLField({...requiredBlankString});

    return schema;
  }
}

export class ShipData extends TwodsixVehicleBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.deckPlan = new fields.StringField({...requiredBlankString});
    schema.crew = makeCrewField();
    schema.crewLabel = makeCrewField();
    schema.cargo = new fields.HTMLField({...requiredBlankString});
    schema.finances = new fields.StringField({...requiredBlankString}); //really should be HTML, but conflicts with traveller finances
    schema.maintenanceCost = new fields.StringField({ required: true, blank: true, initial: "0"});
    schema.mortgageCost = new fields.StringField({ required: true, blank: true, initial: "0"});
    schema.shipValue = new fields.StringField({ required: true, blank: true, initial: "0"});
    schema.isMassProduced = new fields.BooleanField({required: true, initial: false});
    schema.commonFunds = new fields.NumberField({ required: true, nullable: false, integer: false, initial: 0 });
    schema.reqPower = new fields.SchemaField({
      systems: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      "m-drive": new fields.NumberField({ ...requiredInteger, initial: 0 }),
      "j-drive": new fields.NumberField({ ...requiredInteger, initial: 0 }),
      sensors: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      weapons: new fields.NumberField({ ...requiredInteger, initial: 0 })
    });
    schema.weightStats= new fields.SchemaField( {
      systems: new fields.NumberField({ required: true, nullable: false, integer: false, initial: 0 }),
      cargo: new fields.NumberField({ required: true, nullable: false, integer: false, initial: 0 }),
      fuel: new fields.NumberField({ required: true, nullable: false, integer: false, initial: 0 }),
      vehicles: new fields.NumberField({ required: true, nullable: false, integer: false, initial: 0 }),
      available: new fields.NumberField({ required: true, nullable: false, integer: false, initial: 0 })
    });
    schema.shipPositionActorIds = new fields.ObjectField({required: true, initial: {}});
    schema.shipStats = new fields.SchemaField({
      hull: makeResourceField(0, 0),
      fuel: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        min: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        isRefined: new fields.BooleanField({required: true, initial: true})
      }),
      power: makeResourceField(0, 0),
      armor: new fields.SchemaField({
        name: new fields.StringField({...requiredBlankString}),
        weight: new fields.StringField({...requiredBlankString}),
        cost: new fields.StringField({...requiredBlankString}),
        value: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        min: new fields.NumberField({ ...requiredInteger, initial: 0 })
      }),
      mass: makeResourceField(0, 0),
      fuel_tanks: new fields.SchemaField({
        name: new fields.StringField({...requiredBlankString}),
        weight: new fields.StringField({...requiredBlankString}),
        cost: new fields.StringField({...requiredBlankString})
      }),
      drives: new fields.SchemaField({
        overdrive: new fields.BooleanField({required: true, initial: false}),
        jDrive: new fields.SchemaField({
          rating: new fields.NumberField({ ...requiredInteger, initial: 0 })
        }),
        mDrive: new fields.SchemaField({
          rating: new fields.NumberField({ ...requiredInteger, initial: 0 })
        })
      }),
      bandwidth: makeResourceField(0, 0)
    });
    schema.combatPosition = new fields.NumberField({ ...requiredInteger, initial: 0 });
    return schema;
  }
}

export function makeCrewField():any {
  return new fields.SchemaField({
    captain: new fields.StringField({...requiredBlankString}),
    pilot: new fields.StringField({...requiredBlankString}),
    astrogator: new fields.StringField({...requiredBlankString}),
    engineer: new fields.StringField({...requiredBlankString}),
    maintenance: new fields.StringField({...requiredBlankString}),
    gunner: new fields.StringField({...requiredBlankString}),
    medic: new fields.StringField({...requiredBlankString}),
    admin: new fields.StringField({...requiredBlankString}),
    steward: new fields.StringField({...requiredBlankString}),
    broker: new fields.StringField({...requiredBlankString}),
    marine: new fields.StringField({...requiredBlankString}),
    other: new fields.StringField({...requiredBlankString})
  });
}


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
        regular: new fields.NumberField({ ...requiredInteger, initial: 0 }),
        critical: new fields.NumberField({ ...requiredInteger, initial: 0 })
      })
    });
    schema.features = new fields.StringField({...requiredBlankString});
    schema.maneuver = new fields.SchemaField( {
      speed: new fields.StringField({ required: true, blank: true, initial: "0"}),
      speedUnits: new fields.StringField({ required: true, blank: true, initial: "km/h"}),
      range: new fields.StringField({ required: true, blank: true, initial: "0"}),
      rangeUnits: new fields.StringField({ required: true, blank: true, initial: "km"}),
      agility: new fields.StringField({...requiredBlankString})
    });
    schema.skillToOperate = new fields.StringField({...requiredBlankString});
    schema.systemStatus= new fields.SchemaField({
      cargo: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      cockpit: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      computers: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      electronics: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      limbs: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      propulsion: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      powerPlant: new fields.StringField({ required: true, blank: false, initial: "operational"}),
      sensors: new fields.StringField({ required: true, blank: false, initial: "operational"})
    });
    schema.weaponsType = new fields.StringField({...requiredBlankString});
    schema.openVehicle = new fields.BooleanField({required: true, initial: false});
    schema.traits = new fields.StringField({...requiredBlankString});
    schema.weight = new fields.StringField({...requiredBlankString});
    schema.shippingSize = new fields.StringField({...requiredBlankString});
    return schema;
  }
}

export class SpaceObjectData extends TwodsixVehicleBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.features = new fields.StringField({...requiredBlankString});
    schema.count = makeResourceField(0, 0);
    schema.damage = new fields.StringField({ required: true, blank: true, initial: "3D6"});
    schema.thrust = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.roundsActive = new fields.NumberField({ ...requiredInteger, initial: 0 });

    return schema;
  }
}
