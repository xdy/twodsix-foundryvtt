import { fields, makeSecondaryArmorField, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { TwodsixActorBaseData } from './character-base.js';

export class AnimalData extends TwodsixActorBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.homeWorld = new fields.StringField({...requiredBlankString});
    schema.species = new fields.StringField({...requiredBlankString});
    schema.animalType = new fields.SchemaField({
      niche: new fields.StringField({required: true, blank: false, initial: "herbivore"}),
      subtype: new fields.StringField({required: true, blank: false, initial: "filter"})
    });
    schema.location = new fields.StringField({required: true, blank: false, initial: "plains"});
    schema.size = new fields.StringField({...requiredBlankString});
    schema.numberAppearing = new fields.StringField({required: true, blank: false, initial: "1d6"});
    schema.reaction = new fields.SchemaField({
      attack: new fields.NumberField({...requiredInteger, initial: 9}),
      flee: new fields.NumberField({...requiredInteger, initial: 6})
    });
    schema.moraleDM = new fields.StringField({...requiredBlankString});

    schema.secondaryArmor = makeSecondaryArmorField();
    return schema;
  }
}
