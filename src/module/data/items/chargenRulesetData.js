import { fields, requiredBlankString } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

export class ChargenRulesetData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.ruleset = new fields.StringField({...requiredBlankString, initial: "CE"});

    // Aging table: 8 rows. Row 7 has noEffect=true (represents the null/"1+ no effect" row).
    // physStr/physDex/physEnd are the point reductions applied to each physical characteristic.
    schema.agingTable = new fields.ArrayField(
      new fields.SchemaField({
        physStr: new fields.NumberField({required: true, integer: true, nullable: true, initial: 0}),
        physDex: new fields.NumberField({required: true, integer: true, nullable: true, initial: 0}),
        physEnd: new fields.NumberField({required: true, integer: true, nullable: true, initial: 0}),
        mental: new fields.NumberField({required: true, integer: true, nullable: true, initial: 0}),
        noEffect: new fields.BooleanField({required: true, initial: false})
      }),
      {
        initial: [
          {physStr: 2, physDex: 2, physEnd: 2, mental: 1, noEffect: false}, // ≤-6
          {physStr: 2, physDex: 2, physEnd: 2, mental: 0, noEffect: false}, // -5
          {physStr: 2, physDex: 2, physEnd: 1, mental: 0, noEffect: false}, // -4
          {physStr: 2, physDex: 1, physEnd: 1, mental: 0, noEffect: false}, // -3
          {physStr: 1, physDex: 1, physEnd: 1, mental: 0, noEffect: false}, // -2
          {physStr: 1, physDex: 1, physEnd: 0, mental: 0, noEffect: false}, // -1
          {physStr: 1, physDex: 0, physEnd: 0, mental: 0, noEffect: false}, // 0
          {physStr: 0, physDex: 0, physEnd: 0, mental: 0, noEffect: true},  // 1+ no effect
        ]
      }
    );

    // Index 0 is a placeholder null; indices 1-6 correspond to d6 roll results
    const nullableStringArray7 = () => new fields.ArrayField(
      new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      {initial: [null, '', '', '', '', '', '']}
    );
    schema.mishapDesc = nullableStringArray7();
    schema.injuryDesc = nullableStringArray7();
    schema.draftTable = nullableStringArray7();

    // Cascade skills: parent skill name -> list of specialization options
    schema.cascadeSkills = new fields.ArrayField(
      new fields.SchemaField({
        skill: new fields.StringField({...requiredBlankString}),
        specializations: new fields.ArrayField(new fields.StringField({...requiredBlankString}))
      })
    );

    // Homeworld descriptors: world characteristic -> bonus skill
    schema.homeworldDescriptors = new fields.ArrayField(
      new fields.SchemaField({
        descriptor: new fields.StringField({...requiredBlankString}),
        skill: new fields.StringField({...requiredBlankString})
      })
    );

    // Education skills available from education checks
    schema.educationSkills = new fields.ArrayField(
      new fields.StringField({...requiredBlankString})
    );

    // Skill name aliases: informal name used in tables -> canonical skill name
    schema.skillNameMap = new fields.ArrayField(
      new fields.SchemaField({
        from: new fields.StringField({...requiredBlankString}),
        to: new fields.StringField({...requiredBlankString})
      })
    );

    // Characteristic key map: muster-out benefit string -> characteristic key
    schema.charKeyMap = new fields.ArrayField(
      new fields.SchemaField({
        benefit: new fields.StringField({...requiredBlankString}),
        key: new fields.StringField({...requiredBlankString})
      })
    );

    // CU (Cepheus Universal) specific fields — all optional; CE ruleset leaves these at defaults

    // Available creation modes. Empty = CE single-mode; ['career','random','design'] for CU.
    schema.creationModes = new fields.ArrayField(
      new fields.StringField({...requiredBlankString}),
      {initial: []}
    );

    // Shared skill category tables used by CU (random/design/career skill rolls)
    schema.skillCategoryTables = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({...requiredBlankString}),
        entries: new fields.ArrayField(
          new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
          {initial: [null, null, null, null, null, null]}
        )
      }),
      {initial: []}
    );

    // Risk event tables: each entry applies when roll >= threshold (use highest matching)
    const eventTableField = () => new fields.ArrayField(
      new fields.SchemaField({
        threshold: new fields.NumberField({required: true, integer: true, initial: 0}),
        description: new fields.StringField({required: false, blank: true, initial: ''})
      }),
      {initial: []}
    );
    schema.riskFailEvents = eventTableField();
    schema.riskSuccessEvents = eventTableField();
    schema.promotionFailEvents = eventTableField();
    schema.promotionSuccessEvents = eventTableField();

    // Benefits table: 2D6 roll, highest matching threshold wins
    schema.benefitsTable = eventTableField();

    // Narrative reasons for leaving a career (1D6, index 0 unused)
    const leavingTableField = () => new fields.ArrayField(
      new fields.StringField({required: false, blank: true, nullable: true, initial: null}),
      {initial: [null, '', '', '', '', '', '']}
    );
    schema.leavingTableA = leavingTableField();
    schema.leavingTableB = leavingTableField();

    return schema;
  }
}
