// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {TwodsixActorBaseData} from "./character-base";
import { makeValueField } from "./commonSchemaUtils";

const fields = foundry.data.fields;
const requiredInteger = { required: true, nullable: false, integer: true };
const requiredBlankString = { required: true, blank: true, initial: "" };

export class TravellerData extends TwodsixActorBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.homeWorld = new fields.StringField({...requiredBlankString});
    schema.nationality = new fields.StringField({...requiredBlankString});
    schema.species =  new fields.StringField({...requiredBlankString});
    schema.age = new fields.SchemaField({
      value: new fields.NumberField({required: true, nullable: true, integer: false, initial: 18}),
      min: new fields.NumberField({required: true, nullable: true, integer: false, initial: 0})
    });
    schema.gender = new fields.StringField({...requiredBlankString});
    schema.heroPoints = new fields.NumberField({...requiredInteger, initial: 2});
    schema.contacts = new fields.HTMLField({...requiredBlankString});
    /*schema.allies = new fields.HTMLField({...requiredBlankString});
    schema.enemies = new fields.HTMLField({...requiredBlankString});*/
    schema.secondaryArmor = makeValueField();

    schema.finances = new fields.SchemaField({
      cash: new fields.StringField({ required: true, blank: true, initial: "0"}),
      pension: new fields.StringField({ required: true, blank: true, initial: "0"}),
      payment: new fields.StringField({ required: true, blank: true, initial: "0"}),
      debt: new fields.StringField({ required: true, blank: true, initial: "0"}),
      livingCosts: new fields.StringField({ required: true, blank: true, initial: "0"}),
      'financial-notes': new fields.StringField({...requiredBlankString})
    });
    schema.financeValues = new fields.SchemaField({
      cash: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      pension: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      payment: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      debt: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0}),
      livingCosts: new fields.NumberField({required: true, nullable: false, integer: false, initial: 0})
    });

    schema.hideStoredItems = new fields.SchemaField({
      weapon: new fields.BooleanField({ required: true, initial: false}),
      armor: new fields.BooleanField({ required: true, initial: false}),
      augment: new fields.BooleanField({ required: true, initial: false}),
      equipment: new fields.BooleanField({ required: true, initial: false}),
      consumable: new fields.BooleanField({ required: true, initial: false}),
      attachment: new fields.BooleanField({ required: true, initial: false}),
      junk: new fields.BooleanField({ required: true, initial: false})
    });

    schema.experience = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0}),
      totalEarned: new fields.NumberField({...requiredInteger, initial: 0})
    });

    schema.xpNotes = new fields.HTMLField({...requiredBlankString});
    schema.displaySkillGroup = new fields.ObjectField({required: true, initial: {}});

    return schema;
  }
}

export class AnimalData extends TwodsixActorBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.homeWorld = new fields.StringField({...requiredBlankString});
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

    schema.secondaryArmor = new fields.SchemaField({
      value: new fields.NumberField({required: true, integer: true, initial: 0}),
      protectionTypes: new fields.ArrayField(new fields.StringField({blank: false}))
    });
    return schema;
  }
}

export class RobotData extends TwodsixActorBaseData {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.size = new fields.StringField({...requiredBlankString});
    schema.locomotionType = new fields.StringField({...requiredBlankString});
    schema.locomotionType = new fields.StringField({...requiredBlankString});
    schema.price = new fields.StringField({...requiredBlankString});
    schema.chassis = new fields.StringField({...requiredBlankString});
    schema.techLevel = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.operationalTime = new fields.StringField({...requiredBlankString});
    schema.secondaryArmor = new fields.SchemaField({
      value: new fields.NumberField({required: true, integer: true, initial: 0}),
      protectionTypes: new fields.ArrayField(new fields.StringField({blank: false}))
    });
    return schema;
  }
}
