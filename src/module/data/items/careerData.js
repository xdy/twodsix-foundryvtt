import { fields, requiredBlankString } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

/**
 * @typedef StructuredEventEntry
 * @property {number} roll
 * @property {string} description
 * @property {object[]} checks
 * @property {object[]} always
 * @property {object[]} onSuccess
 * @property {object[]} onFail
 * @property {object[]} effects
 * @property {string|null} branchPrompt
 * @property {object[]} branchChoices
 */

export class CareerData extends TwodsixItemBaseData {
  /**
   * Shared factory for event/mishap structured table entries.
   * Both tables use the same shape: a roll-determined description with optional
   * skill-checks, unconditional effects, success/fail outcomes, effect lists,
   * and optional branching prompts.
   * @returns {typeof fields.SchemaField}
   */
  static _structuredEventSchema() {
    return new fields.SchemaField({
      roll: new fields.NumberField({required: true, integer: true}),
      description: new fields.StringField({required: true, blank: true}),
      checks: new fields.ArrayField(new fields.ObjectField({required: false}), {initial: []}),
      always: new fields.ArrayField(new fields.ObjectField({required: false}), {initial: []}),
      onSuccess: new fields.ArrayField(new fields.ObjectField({required: false}), {initial: []}),
      onFail: new fields.ArrayField(new fields.ObjectField({required: false}), {initial: []}),
      effects: new fields.ArrayField(new fields.ObjectField({required: false}), {initial: []}),
      branchPrompt: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      branchChoices: new fields.ArrayField(new fields.ObjectField({required: false}), {initial: []}),
    });
  }

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

    // CDEE (Cepheus Deluxe Enhanced Edition) structured tables — shared schema across event and mishap
    schema.eventTable = new fields.ArrayField(CareerData._structuredEventSchema(), {initial: []});
    schema.mishapTable = new fields.ArrayField(CareerData._structuredEventSchema(), {initial: []});
    schema.assignmentTable = new fields.ObjectField({required: false, nullable: false, initial: {}});
    schema.officerRanks = new fields.ArrayField(new fields.SchemaField({
      title: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      skill: new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      level: new fields.NumberField({required: true, integer: true, initial: 0}),
    }), {initial: []});
    schema.isMilitary = new fields.BooleanField({required: false, initial: false});

    /** Ruleset-agnostic extension payload for third-party chargen. Not used by CE/CU core flows. */
    schema.chargenExtensions = new fields.ObjectField({ required: false, nullable: false, initial: {} });

    return schema;
  }
}
