import { fields, migrateStringToStringArray, requiredBlankString } from '../commonSchemaUtils.js';

export class TwodsixItemBaseData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.name = new fields.StringField({required: false, blank: true, nullable: true, initial: ""});
    schema.description = new fields.HTMLField({...requiredBlankString});
    schema.type = new fields.StringField({...requiredBlankString}); //updated onCreate
    /* References */
    schema.docReference = new fields.ArrayField(new fields.StringField({...requiredBlankString}), {initial: [""]});
    schema.pdfReference = new fields.SchemaField({
      type: new fields.StringField({...requiredBlankString}),
      href: new fields.StringField({...requiredBlankString}),
      label: new fields.StringField({...requiredBlankString})
    });
    schema.priorType = new fields.StringField({required: true, blank: false, initial: "unknown"});
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
export function makeTargetTemplate() {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, nullable: true, integer: false, initial: null}),
    width: new fields.NumberField({required: true, nullable: true, integer: false, initial: null}),
    units: new fields.StringField({required: true, blank: true, initial: "m"}),
    type: new fields.StringField({required: true, blank: true, initial: "none"})
  });
}
