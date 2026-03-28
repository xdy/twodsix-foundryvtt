import { fields, migrateStringToStringArray, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';

export class TwodsixVehicleBaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.name = new fields.StringField({...requiredBlankString});
    schema.techLevel = new fields.NumberField({...requiredInteger, initial: 0});
    /* References */
    schema.docReference = new fields.ArrayField(new fields.StringField({...requiredBlankString}), {initial: [""]});
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

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("docReference" in source) {
      migrateStringToStringArray(source, "docReference");
      if (source.docReference.length === 0) {
        source.docReference = [""];
      }
    }
    return super.migrateData(source);
  }
}

/**
 * @returns {foundry.data.fields.SchemaField}
 */
export function makeCrewField() {
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


