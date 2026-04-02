import {
  fields,
  makeResourceField,
  migrateNumberToString,
  migrateStringToNumber,
  requiredBlankString,
  requiredInteger
} from '../commonSchemaUtils.js';
import { COMPONENT_SUBTYPES } from '../../config.js';
import { GearData } from './gear-data.js';

export class ComponentData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subtype = new fields.StringField({required: true, blank: false, initial: COMPONENT_SUBTYPES.OTHER_INTERNAL});
    schema.powerDraw = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.rating = new fields.StringField({...requiredBlankString});
    schema.availableQuantity = new fields.StringField({...requiredBlankString});
    schema.hits = new fields.NumberField({...requiredInteger, initial: 0});
    schema.damage = new fields.StringField({...requiredBlankString});
    schema.radDamage = new fields.StringField({...requiredBlankString});
    schema.range = new fields.StringField({...requiredBlankString});
    schema.status = new fields.StringField({required: true, blank: false, initial: "operational"});
    schema.driveType = new fields.StringField({required: true, blank: false, initial: "other"});
    schema.weightIsPct = new fields.BooleanField({required: true, initial: false});
    schema.isIllegal = new fields.BooleanField({required: true, initial: false});
    schema.purchasePrice = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});//new fields.StringField({...requiredBlankString});
    schema.buyPricePerTon = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.sellPricePerTon = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.buyPriceMod = new fields.NumberField({required: true, nullable: false, integer: false, initial: 100});
    schema.sellPriceMod = new fields.NumberField({required: true, nullable: false, integer: false, initial: 100});
    schema.cargoLocation = new fields.StringField({...requiredBlankString});
    schema.generatesPower = new fields.BooleanField({required: true, initial: false});
    schema.isRefined = new fields.BooleanField({required: true, initial: false});
    schema.features = new fields.StringField({...requiredBlankString});
    schema.pricingBasis = new fields.StringField({required: true, blank: false, initial: "perUnit"});
    schema.powerBasis = new fields.StringField({required: true, blank: false, initial: "perUnit"});
    schema.isBaseHull = new fields.BooleanField({required: true, initial: false});
    schema.rollModifier = new fields.StringField({...requiredBlankString});
    schema.rateOfFire = new fields.StringField({...requiredBlankString});
    schema.armorPiercing = new fields.StringField({required: true, blank: false, initial: "0"});
    schema.actorLink = new fields.StringField({...requiredBlankString});
    schema.hardened = new fields.BooleanField({required: true, initial: false});
    schema.ammunition = makeResourceField(0, 0);
    schema.isPopup = new fields.BooleanField({required: true, initial: false});
    schema.isExtended = new fields.BooleanField({required: true, initial: false});
    schema.bandwidth = new fields.NumberField({...requiredInteger, initial: 0});
    schema.fireArc = new fields.SchemaField({
      startAngle: new fields.NumberField({...requiredInteger, initial: 0}),
      endAngle: new fields.NumberField({...requiredInteger, initial: 0})
    });
    schema.shipWeaponType = new fields.StringField({...requiredBlankString});
    schema.ammoLink = new fields.StringField({required: true, blank: false, initial: "none"});
    return schema;
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("purchasePrice" in source) {
      migrateStringToNumber(source, "purchasePrice");
    }
    if ("armorPiercing" in source) {
      if (typeof source.armorPiercing !== 'string') {
        migrateNumberToString(source, 'armorPiercing');
      }
    }
    if ("shipWeaponType" in source) {
      if (source.shipWeaponType === "") {
        source.shipWeaponType = "other";
      }
    }
    if ("subtype" in source) {
      if (source.subtype === "accomodations") {
        source.subtype = COMPONENT_SUBTYPES.ACCOMMODATIONS;
      }
    }
    return super.migrateData(source);
  }

  // ─── Semantic getters ────────────────────────────────────────────────────

  /** True for cargo or ammo — stored in cargo hold rather than as a system. */
  get isStoredInCargo() {
    return [COMPONENT_SUBTYPES.CARGO, COMPONENT_SUBTYPES.AMMO].includes(this.subtype);
  }

  /** True for armament or ammo — participates in weapon attack rolls. */
  get isWeapon() {
    return [COMPONENT_SUBTYPES.ARMAMENT, COMPONENT_SUBTYPES.AMMO].includes(this.subtype);
  }

  /** True only for the armament subtype. */
  get isArmament() {
    return this.subtype === COMPONENT_SUBTYPES.ARMAMENT;
  }

  /** True for armament or mount — can have a popup mount. */
  get canBePopup() {
    return [COMPONENT_SUBTYPES.ARMAMENT, COMPONENT_SUBTYPES.MOUNT].includes(this.subtype);
  }

  /** True for subtypes excluded from ship cost calculations. */
  get isExcludedFromCost() {
    return [COMPONENT_SUBTYPES.FUEL, COMPONENT_SUBTYPES.CARGO,
      COMPONENT_SUBTYPES.AMMO, COMPONENT_SUBTYPES.VEHICLE].includes(this.subtype);
  }

  /** True for computer — adds available bandwidth. */
  get contributesBandwidth() {
    return this.subtype === COMPONENT_SUBTYPES.COMPUTER;
  }

  /** True for software — consumes bandwidth. */
  get consumesBandwidth() {
    return this.subtype === COMPONENT_SUBTYPES.SOFTWARE;
  }

  /** True when this subtype is allowed to be hardened. */
  get canBeHardened() {
    return ![COMPONENT_SUBTYPES.FUEL, COMPONENT_SUBTYPES.CARGO,
      COMPONENT_SUBTYPES.AMMO, COMPONENT_SUBTYPES.STORAGE,
      COMPONENT_SUBTYPES.VEHICLE].includes(this.subtype);
  }

  /** True when weightIsPct must be false for this subtype. */
  get weightIsPctForbidden() {
    return [COMPONENT_SUBTYPES.CARGO, COMPONENT_SUBTYPES.AMMO].includes(this.subtype);
  }

  /** True when hull-based pricing is forbidden for this subtype. */
  get hullPricingForbidden() {
    return this.subtype === COMPONENT_SUBTYPES.AMMO;
  }

  /** Weight bucket name for ship weight calculations. */
  get weightCategory() {
    switch (this.subtype) {
      case COMPONENT_SUBTYPES.VEHICLE: return "vehicles";
      case COMPONENT_SUBTYPES.CARGO:
      case COMPONENT_SUBTYPES.AMMO: return "cargo";
      case COMPONENT_SUBTYPES.FUEL: return "fuel";
      case COMPONENT_SUBTYPES.HULL: return "hull";
      default: return "systems";
    }
  }

  /** Power bucket name for ship power calculations (non-generators only). */
  get powerCategory() {
    switch (this.subtype) {
      case COMPONENT_SUBTYPES.DRIVE: return "drive";
      case COMPONENT_SUBTYPES.SENSOR: return "sensors";
      case COMPONENT_SUBTYPES.ARMAMENT: return "weapons";
      default: return "systems";
    }
  }

  // ─── Static helpers ──────────────────────────────────────────────────────

  /**
   * Returns constraint flags for a given subtype string.
   * Used in _preUpdate when the subtype is changing (instance subtype is the old value).
   */
  static constraintsForSubtype(subtype) {
    return {
      weightIsPctForbidden: [COMPONENT_SUBTYPES.CARGO, COMPONENT_SUBTYPES.AMMO].includes(subtype),
      canBeHardened: ![COMPONENT_SUBTYPES.FUEL, COMPONENT_SUBTYPES.CARGO,
        COMPONENT_SUBTYPES.AMMO, COMPONENT_SUBTYPES.STORAGE,
        COMPONENT_SUBTYPES.VEHICLE].includes(subtype),
      hullPricingForbidden: subtype === COMPONENT_SUBTYPES.AMMO,
      isBaseHullAllowed: subtype === COMPONENT_SUBTYPES.HULL,
    };
  }
}
