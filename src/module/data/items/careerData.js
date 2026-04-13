import { fields, requiredBlankString } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

export class CareerData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    // Qualification check
    schema.qual = new fields.SchemaField({
      char: new fields.StringField({...requiredBlankString, initial: "int"}),
      target: new fields.NumberField({required: true, integer: true, initial: 0})
    });

    // Survival check
    schema.surv = new fields.SchemaField({
      char: new fields.StringField({...requiredBlankString, initial: "end"}),
      target: new fields.NumberField({required: true, integer: true, initial: 0})
    });

    // Commission check
    schema.comm = new fields.SchemaField({
      char: new fields.StringField({...requiredBlankString, initial: "soc"}),
      target: new fields.NumberField({required: true, integer: true, initial: 0})
    });

    // Advancement check
    schema.adv = new fields.SchemaField({
      char: new fields.StringField({...requiredBlankString, initial: "edu"}),
      target: new fields.NumberField({required: true, integer: true, initial: 0})
    });

    schema.reenlist = new fields.NumberField({required: true, integer: true, initial: 0});
    schema.ruleset = new fields.StringField({...requiredBlankString, initial: "CE"});
    schema.hasCommAdv = new fields.BooleanField({required: true, initial: false});

    // Ranks array: [{"title": "Airman", "skill": "Aircraft", "level": 1}, ...]
    schema.ranks = new fields.ArrayField(new fields.SchemaField({
      title: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      skill: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      level: new fields.NumberField({required: true, integer: true, initial: 0})
    }));

    // Skill Tables: each is an array of 6 strings
    const skillTableField = () => new fields.ArrayField(new fields.StringField({...requiredBlankString}), {initial: ["", "", "", "", "", ""]});
    schema.personal = skillTableField();
    schema.service = skillTableField();
    schema.specialist = skillTableField();
    schema.advanced = skillTableField();

    // Muster Out: Material Benefits (7 entries) and Cash (7 entries)
    schema.material = new fields.ArrayField(new fields.StringField({required: false, blank: true, nullable: true, initial: null}), {initial: ["", "", "", "", "", "", ""]});
    schema.cash = new fields.ArrayField(new fields.NumberField({required: true, integer: true, initial: 0}), {initial: [0, 0, 0, 0, 0, 0, 0]});

    // CU (Cepheus Universal) specific fields — all nullable/optional; CE careers leave these at defaults
    schema.riskTarget = new fields.NumberField({required: false, integer: true, nullable: true, initial: null});
    schema.promotionTarget = new fields.NumberField({required: false, integer: true, nullable: true, initial: null});
    schema.preferredChar = new fields.StringField({required: false, blank: true, nullable: true, initial: null});
    schema.autoSkill = new fields.StringField({required: false, blank: true, nullable: true, initial: null});
    schema.cashBase = new fields.NumberField({required: false, integer: true, nullable: true, initial: null});
    schema.skillTable1 = new fields.StringField({required: false, blank: true, nullable: true, initial: null});
    schema.skillTable2 = new fields.StringField({required: false, blank: true, nullable: true, initial: null});
    schema.skillTable2Options = new fields.ArrayField(new fields.StringField({...requiredBlankString}), {initial: []});
    schema.hasCommissioned = new fields.BooleanField({required: false, initial: false});
    schema.officerCashMultiplier = new fields.NumberField({required: false, integer: true, initial: 1});
    schema.commissionedRanks = new fields.ArrayField(new fields.SchemaField({
      title: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      skill: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      level: new fields.NumberField({required: true, integer: true, initial: 0})
    }), {initial: []});

    // CDEE (Cepheus Deluxe Enhanced Edition) specific fields
    schema.eventTable = new fields.ArrayField(new fields.SchemaField({
      roll: new fields.NumberField({required: true, integer: true}),
      description: new fields.StringField({required: true, blank: true})
    }), {initial: []});
    schema.isMilitary = new fields.BooleanField({required: false, initial: false});

    return schema;
  }
}
