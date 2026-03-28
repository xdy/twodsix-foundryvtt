import { calcModFor } from '../../utils/sheetUtils.js';
import { makeCharacteristicField } from '../actors/character-base.js';
import { fields, makeResourceField, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { makeCrewField, TwodsixVehicleBaseData } from './vehicles-base.js';

export class ShipData extends TwodsixVehicleBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.deckPlan = new fields.StringField({...requiredBlankString});
    schema.crew = makeCrewField();
    schema.crewLabel = makeCrewField();
    schema.cargo = new fields.HTMLField({...requiredBlankString});
    schema.financeNotes = new fields.HTMLField({...requiredBlankString});
    schema.maintenanceCost = new fields.StringField({required: true, blank: true, initial: "0"});
    schema.mortgageCost = new fields.StringField({required: true, blank: true, initial: "0"});
    schema.shipValue = new fields.StringField({required: true, blank: true, initial: "0"});
    schema.isMassProduced = new fields.BooleanField({required: true, initial: false});
    schema.showWeightUsage = new fields.BooleanField({required: true, initial: false});
    schema.commonFunds = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.financeValues = new fields.SchemaField({
      cash: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      mortgagePaymentTerm: new fields.NumberField({required: true, nullable: false, integer: true, initial: 240}),
      massProductionDiscount: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0.1}),
    });
    schema.reqPower = new fields.SchemaField({
      systems: new fields.NumberField({...requiredInteger, initial: 0}),
      mDrive: new fields.NumberField({...requiredInteger, initial: 0}),
      jDrive: new fields.NumberField({...requiredInteger, initial: 0}),
      sensors: new fields.NumberField({...requiredInteger, initial: 0}),
      weapons: new fields.NumberField({...requiredInteger, initial: 0})
    });
    schema.weightStats = new fields.SchemaField({
      systems: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      cargo: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      fuel: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      vehicles: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      available: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0})
    });
    schema.shipPositionActorIds = new fields.ObjectField({required: true, initial: {}});
    schema.shipStats = new fields.SchemaField({
      hull: makeResourceField(0, 0),
      fuel: new fields.SchemaField({
        value: new fields.NumberField({...requiredInteger, initial: 0}),
        max: new fields.NumberField({...requiredInteger, initial: 0}),
        min: new fields.NumberField({...requiredInteger, initial: 0}),
        isRefined: new fields.BooleanField({required: true, initial: true})
      }),
      power: makeResourceField(0, 0),
      armor: new fields.SchemaField({
        name: new fields.StringField({...requiredBlankString}),
        weight: new fields.StringField({...requiredBlankString}),
        cost: new fields.StringField({...requiredBlankString}),
        value: new fields.NumberField({...requiredInteger, initial: 0}),
        max: new fields.NumberField({...requiredInteger, initial: 0}),
        min: new fields.NumberField({...requiredInteger, initial: 0})
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
          rating: new fields.NumberField({...requiredInteger, initial: 0})
        }),
        mDrive: new fields.SchemaField({
          rating: new fields.NumberField({...requiredInteger, initial: 0})
        })
      }),
      bandwidth: makeResourceField(0, 0)
    });
    schema.combatPosition = new fields.NumberField({...requiredInteger, initial: 0});
    schema.characteristics = new fields.SchemaField({morale: makeCharacteristicField("morale", "MOR")});
    return schema;
  }

  /**
   * Compute derived characteristic fields (current, mod) from persisted values.
   * @override
   */
  prepareDerivedData() {
    if (!this.characteristics) {
      return;
    }
    for (const characteristic of Object.values(this.characteristics)) {
      characteristic.current = characteristic.value - characteristic.damage;
      characteristic.mod = calcModFor(characteristic.current);
    }
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("finances" in source) {
      if (typeof source.finances === 'string' && source.financeNotes === "") {
        source.financeNotes = source.finances;
      }
    }
    return super.migrateData(source);
  }
}
