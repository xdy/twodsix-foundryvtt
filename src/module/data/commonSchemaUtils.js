export const fields = foundry.data.fields;
export const requiredInteger = {required: true, nullable: false, integer: true};
export const requiredBlankString = {required: true, blank: true, initial: ""};

/**
 * Data structure for character's resources.
 * @param {number} initialValue initial Value
 * @param {number} initialMax initial Maximum
 * @param {object} schemaOptions  Options passed to the outer schema.
 * @returns {foundry.data.fields.SchemaField}
 */
export function makeResourceField(initialValue, initialMax, schemaOptions = {}) {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, integer: true, initial: initialValue}),
    max: new fields.NumberField({required: true, integer: true, initial: initialMax}),
    min: new fields.NumberField({required: true, integer: true, initial: 0}),
    label: new fields.StringField({required: true})
  }, schemaOptions);
}

/**
 * Produce the schema field for a simple value trait.
 * @param {number} initialValue
 * @param {object} schemaOptions  Options passed to the outer schema.
 * @returns {foundry.data.fields.SchemaField}
 */
export function makeValueField(initialValue = 0, schemaOptions = {}) {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, integer: false, initial: initialValue}),
  }, schemaOptions);
}

/**
 * Produce the schema field for a secondary armor block used by animals/robots.
 * It matches the explicit schema used in `characters.ts` for animals and robots.
 * @param {number} initialValue
 * @param {object} schemaOptions
 * @returns {foundry.data.fields.SchemaField}
 */
export function makeSecondaryArmorField(initialValue = 0, schemaOptions = {}) {
  return new fields.SchemaField({
    value: new fields.NumberField({required: true, integer: false, initial: initialValue}),
    protectionTypes: new fields.ArrayField(new fields.StringField({blank: false}))
  }, schemaOptions);
}

/**
 * Parse a localized number string to a float.
 * @param {string} stringNumber - The localized number string.
 * @returns {number} - The float value of the localized number.
 */
export function parseLocaleNumber(stringNumber) {
  if (stringNumber) {
    const thousandSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(11111)[1].value;
    const decimalSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(1.1)[1].value;

    return parseFloat(
      stringNumber
        .replace(new RegExp('\\' + thousandSeparator, 'g'), '')
        .replace(new RegExp('\\' + decimalSeparator), '.')
    );
  } else {
    return NaN;
  }
}

/**
 * Convert field from string to number respecting local number format, if necessary.
 * @param {any} source data source (document.system)
 * @param {string} field  system field to convert.
 * @returns {void}
 */
export function migrateStringToNumber(source, field) {
  if (Object.hasOwn(source, field)) {
    if (typeof source[field] !== 'number') {
      source[field] = parseLocaleNumber(source[field]) || 0;
    }
  }
}

/**
 * Convert field from number to string.
 * @param {any} source data source (document.system)
 * @param {string} field  system field to convert.
 * @returns {void}
 */
export function migrateNumberToString(source, field) {
  if (Object.hasOwn(source, field)) {
    if (typeof source[field] !== 'string') {
      source[field] = source[field]?.toString() || "0";
    }
  }
}

/**
 * Convert field from string to string array.
 * @param {any} source data source (document.system)
 * @param {string} field  system field to convert.
 * @returns {void}
 */
export function migrateStringToStringArray(source, field) {
  if (Object.hasOwn(source, field)) {
    if (typeof source[field] !== 'object') {
      source[field] = [source[field] ?? ""];
    }
  }
}
