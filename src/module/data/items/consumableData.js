import { fields, migrateNumberToString, requiredBlankString, requiredInteger } from '../commonSchemaUtils.js';
import { CONSUMABLE_SUBTYPES } from '../../config.js';
import { GearData } from './gear-data.js';
import { makeTargetTemplate } from './item-base.js';

export class ConsumableData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.currentCount = new fields.NumberField({...requiredInteger, initial: 1});
    schema.max = new fields.NumberField({...requiredInteger, initial: 0});
    schema.subtype = new fields.StringField({required: true, blank: false, initial: CONSUMABLE_SUBTYPES.OTHER});
    schema.armorPiercing = new fields.StringField({required: true, blank: false, initial: "0"});
    schema.bonusDamage = new fields.StringField({...requiredBlankString});
    schema.ammoRangeModifier = new fields.StringField({required: true, blank: false, initial: "0"});
    schema.isAttachment = new fields.BooleanField({required: true, initial: false});
    schema.bandwidth = new fields.NumberField({...requiredInteger, initial: 0});
    schema.softwareActive = new fields.BooleanField({required: true, initial: true});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "NONE"});
    schema.parentName = new fields.StringField({...requiredBlankString});
    schema.parentType = new fields.StringField({...requiredBlankString});
    schema.target = makeTargetTemplate();
    return schema;
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("ammoRangeModifier" in source) {
      if (source.ammoRangeModifier === "") {
        source.ammoRangeModifier = "0";
      }
    }
    if ("armorPiercing" in source) {
      if (typeof source.armorPiercing !== 'string') {
        migrateNumberToString(source, 'armorPiercing');
      }
    }
    return super.migrateData(source);
  }

  // ─── Semantic getters ────────────────────────────────────────────────────

  /** True for software — has bandwidth and softwareActive toggle. */
  get isSoftware() {
    return this.subtype === CONSUMABLE_SUBTYPES.SOFTWARE;
  }

  /** True for software, processor, and suite — automatically marked as attachments. */
  get isAttachmentType() {
    return [CONSUMABLE_SUBTYPES.SOFTWARE, CONSUMABLE_SUBTYPES.PROCESSOR, CONSUMABLE_SUBTYPES.SUITE].includes(this.subtype);
  }

  /** True for magazine and power_cell — uses "Reload" label instead of "Refill". */
  get isReloadable() {
    return [CONSUMABLE_SUBTYPES.MAGAZINE, CONSUMABLE_SUBTYPES.POWER_CELL].includes(this.subtype);
  }

  // ─── Static helpers ──────────────────────────────────────────────────────

  /**
   * Returns constraint flags for a given subtype string.
   * Used in _preUpdate when the subtype is changing.
   */
  static constraintsForSubtype(subtype) {
    return {
      isAttachmentType: [CONSUMABLE_SUBTYPES.SOFTWARE, CONSUMABLE_SUBTYPES.PROCESSOR,
        CONSUMABLE_SUBTYPES.SUITE].includes(subtype),
    };
  }
}
