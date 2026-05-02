import { fields, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixItemBaseData } from './item-base.js';

/**
 * Data model for `species` item type. Represents an ancestry/alien species an actor can have.
 *
 * - `deltas` — characteristic modifiers applied during chargen (e.g. Aslan STR+2/DEX-2)
 * - `grantedTraitNames` — names of `trait` items the chargen flow embeds alongside the species
 * - `abilityLines` — descriptive lines surfaced in the actor's notes/log
 * - `chargenExtensions` — ruleset-extension payload (parallel to {@link CareerData.chargenExtensions})
 */
export class SpeciesData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.deltas = new fields.SchemaField({
      str: new fields.NumberField({...requiredInteger, initial: 0}),
      dex: new fields.NumberField({...requiredInteger, initial: 0}),
      end: new fields.NumberField({...requiredInteger, initial: 0}),
      int: new fields.NumberField({...requiredInteger, initial: 0}),
      edu: new fields.NumberField({...requiredInteger, initial: 0}),
      soc: new fields.NumberField({...requiredInteger, initial: 0}),
    });

    schema.shortdescr = new fields.StringField({...requiredBlankString});

    schema.grantedTraitNames = new fields.ArrayField(
      new fields.StringField({...requiredBlankString}),
      {initial: []}
    );

    schema.abilityLines = new fields.ArrayField(
      new fields.StringField({...requiredBlankString}),
      {initial: []}
    );

    schema.agingRollBonus = new fields.NumberField({...requiredInteger, initial: 0});
    schema.homeworld = new fields.StringField({...requiredBlankString});
    schema.ruleset = new fields.StringField({...requiredBlankString});

    schema.allowedCareers = new fields.ArrayField(
      new fields.StringField({...requiredBlankString}),
      {initial: []}
    );

    schema.chargenExtensions = new fields.ObjectField({required: false, nullable: false, initial: {}});

    return schema;
  }
}
