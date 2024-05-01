// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { migrateStringToNumber } from "./commonSchemaUtils";

const fields = foundry.data.fields;
const requiredInteger = { required: true, nullable: false, integer: true };
const requiredBlankString = { required: true, blank: true, initial: "" };

export class TwodsixItemBaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.name = new fields.StringField({ required: false, blank: true, nullable: true, initial: "" });
    schema.description = new fields.StringField({...requiredBlankString});
    schema.type = new fields.StringField({...requiredBlankString}); //updated onCreate
    /* References */
    schema.docReference = new fields.StringField({...requiredBlankString});
    schema.pdfReference = new fields.SchemaField({
      type: new fields.StringField({...requiredBlankString}),
      href: new fields.StringField({...requiredBlankString}),
      label: new fields.StringField({...requiredBlankString})
    });
    return schema;
  }
}

export class GearData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.techLevel = new fields.NumberField({...requiredInteger, initial: 0});
    schema.shortdescr = new fields.StringField({...requiredBlankString});
    schema.quantity = new fields.NumberField({...requiredInteger, initial: 1});
    schema.weight = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.price = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.traits = new fields.ArrayField(new fields.StringField({blank: false}));
    schema.consumables = new fields.ArrayField(new fields.StringField({blank: false}));
    schema.useConsumableForAttack = new fields.StringField({...requiredBlankString});
    schema.skillModifier = new fields.NumberField({...requiredInteger, initial: 0});
    schema.skill = new fields.StringField({...requiredBlankString});
    schema.associatedSkillName = new fields.StringField({...requiredBlankString});
    schema.equipped = new fields.StringField({ required: true, blank: false, initial: "backpack"});
    return schema;
  }
  static migrateData(source:any) {
    if (source.weight) {
      migrateStringToNumber(source, "weight");
    }
    if (source.price) {
      migrateStringToNumber(source, "price");
    }
    return super.migrateData(source);
  }
}

export function makeTargetTemplate() {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, nullable: true, integer: false, initial: null}),
    width: new fields.NumberField({required: true, nullable: true, integer: false, initial: null}),
    units: new fields.StringField({ required: true, blank: true, initial: "m"}),
    type: new fields.StringField({ required: true, blank: true, initial: "none"})
  });
}
