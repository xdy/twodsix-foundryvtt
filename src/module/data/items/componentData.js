import {
  fields,
  makeResourceField,
  migrateNumberToString,
  migrateStringToNumber,
  requiredBlankString,
  requiredInteger
} from '../commonSchemaUtils.js';
import { GearData } from './gear-data.js';

export class ComponentData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subtype = new fields.StringField({required: true, blank: false, initial: "otherInternal"});
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
        source.subtype = "accommodations";
      }
    }
    return super.migrateData(source);
  }
}
