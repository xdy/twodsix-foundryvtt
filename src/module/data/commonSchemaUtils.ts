// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { parseLocaleNumber } from "../hooks/updateFinances";

const fields = foundry.data.fields;

/**
 * Data structure for character's resources.
 * @param {number} initialValue initial Value
 * @param {number} initialMax initial Maximum
 * @param {object} schemaOptions  Options passed to the outer schema.
 * @returns {ResourceData}
 */
export function makeResourceField(initialValue:number, initialMax:number, schemaOptions: object={}):ResourceData {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, integer: true, initial: initialValue, labels: "TWODSIX.Resource.Value"}),
    max: new fields.NumberField({required: true, integer: true, initial: initialMax, labels: "TWODSIX.Resource.Max"}),
    min: new fields.NumberField({required: true, integer: true, initial: 0, labels: "TWODSIX.Resource.Min"}),
    label: new fields.StringField({required: true, labels: "TWODSIX.Resource.Label"})
  }, schemaOptions);
}

/**
 * Produce the schema field for a simple value trait.
 * @param {number} initialValue
 * @param {object} schemaOptions  Options passed to the outer schema.
 * @returns {ResourceData}
 */
export function makeValueField(initialValue = 0, schemaOptions: object={}):any {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, integer: true, initial: initialValue, labels: "TWODSIX.Resource.Value"}),
  }, schemaOptions);
}

/**
 * Convert field from string to number respecting local number format, if necessary.
 * @param {any} source data source (docuement.system)
 * @param {string} field  system field to convert.
 * @returns {ResourceData}
 */
export function migrateStringToNumber(source:any, field:string):void {
  if ( Object.hasOwn(source, field)) {
    if ( typeof source[field] !== 'number') {
      source[field] = parseLocaleNumber(source[field]) || 0;
    }
  }
}
