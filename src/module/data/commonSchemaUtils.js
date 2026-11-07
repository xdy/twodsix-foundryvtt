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
 * It matches the explicit schema used in `characters.js` for animals and robots.
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
 * Normalize a localized number and identify its grouping and decimal separators.
 * @param {string} stringNumber - The localized number string.
 * @returns {{input: string, thousandSeparator: string, decimalSeparator: string} | undefined} Normalized input and separators, or undefined for empty or non-string input.
 */
function normalizeLocaleNumber(stringNumber) {
  if (typeof stringNumber !== 'string' || !stringNumber.trim()) {
    return undefined;
  }

  const parts = Intl.NumberFormat(game.i18n.lang).formatToParts(1234567.8);
  const normalizeSpaces = str => str.replace(/[\u00A0\u202F]/g, ' ');
  return {
    input: normalizeSpaces(stringNumber.trim()).replace(/^\u2212/, '-'),
    thousandSeparator: normalizeSpaces(parts.find(p => p.type === 'group')?.value || ''),
    decimalSeparator: parts.find(p => p.type === 'decimal')?.value || '.'
  };
}

/**
 * Parse a localized number using permissive legacy parsing.
 * @param {string} stringNumber - The localized number string.
 * @returns {number} - The parsed number, or NaN.
 */
export function parseLocaleNumber(stringNumber) {
  const normalized = normalizeLocaleNumber(stringNumber);
  if (!normalized) {
    return NaN;
  }
  const {input, thousandSeparator, decimalSeparator} = normalized;
  const ungrouped = thousandSeparator ? input.replaceAll(thousandSeparator, '') : input;
  return parseFloat(ungrouped.replace(decimalSeparator, '.'));
}

/**
 * Parse a complete localized number, requiring correctly grouped digits.
 * @param {string} stringNumber - The localized number string.
 * @returns {number} - The parsed finite number, or NaN.
 */
export function parseStrictLocaleNumber(stringNumber) {
  const normalized = normalizeLocaleNumber(stringNumber);
  if (!normalized) {
    return NaN;
  }
  const {thousandSeparator, decimalSeparator} = normalized;
  let {input} = normalized;

  let sign = '';
  if (input.startsWith('-') || input.startsWith('+')) {
    sign = input[0];
    input = input.slice(1);
  }

  const numberParts = input.split(decimalSeparator);
  if (numberParts.length > 2 || (numberParts.length === 2 && !/^\d*$/.test(numberParts[1]))) {
    return NaN;
  }
  const integer = numberParts[0];
  const groups = thousandSeparator ? integer.split(thousandSeparator) : [integer];
  const validInteger = groups.length === 1
    ? /^\d*$/.test(integer)
    : /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every(group => /^\d{3}$/.test(group));
  if (!validInteger || (!integer && !numberParts[1])) {
    return NaN;
  }
  const result = Number(`${sign}${groups.join('') || '0'}${numberParts.length === 2 ? `.${numberParts[1]}` : ''}`);
  return Number.isFinite(result) ? result : NaN;
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
