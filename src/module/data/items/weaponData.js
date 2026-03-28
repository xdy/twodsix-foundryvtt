import {
  fields,
  migrateNumberToString,
  migrateStringToNumber,
  requiredBlankString,
  requiredInteger
} from '../commonSchemaUtils.js';
import { GearData } from './gear-data.js';
import { makeTargetTemplate } from './item-base.js';

export class WeaponData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.target = makeTargetTemplate();
    schema.range = new fields.StringField({...requiredBlankString});
    schema.damage = new fields.StringField({required: true, blank: true, initial: ""});
    schema.damageBonus = new fields.NumberField({required: true, nullable: true, integer: true, initial: 0});
    schema.magazineSize = new fields.NumberField({...requiredInteger, initial: 0});
    schema.ammo = new fields.NumberField({...requiredInteger, initial: 0}); //;new fields.StringField({...requiredBlankString});
    schema.magazineCost = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});
    schema.lawLevel = new fields.StringField({...requiredBlankString});//new fields.NumberField({required: true, nullable: true, integer: true , initial: 0});
    schema.rangeBand = new fields.StringField({required: true, blank: false, initial: "none"});
    schema.weaponType = new fields.StringField({...requiredBlankString});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "NONE"});
    schema.rateOfFire = new fields.StringField({...requiredBlankString});
    schema.doubleTap = new fields.BooleanField({required: true, initial: false});
    schema.isSingleAction = new fields.BooleanField({required: true, initial: false});
    schema.recoil = new fields.BooleanField({required: true, initial: false});
    schema.features = new fields.StringField({...requiredBlankString});
    schema.armorPiercing = new fields.StringField({required: true, blank: false, initial: "0"});
    schema.parryAV = new fields.NumberField({...requiredInteger, initial: 0});
    schema.isShield = new fields.BooleanField({required: true, initial: false});
    schema.handlingModifiers = new fields.StringField({...requiredBlankString});
    schema.meleeRangeModifier = new fields.StringField({required: true, blank: true, initial: "0"});
    schema.customCT = new fields.SchemaField({
      armor: new fields.SchemaField({
        nothing: new fields.StringField({required: true, blank: true, initial: "0"}),
        jack: new fields.StringField({required: true, blank: true, initial: "0"}),
        mesh: new fields.StringField({required: true, blank: true, initial: "0"}),
        cloth: new fields.StringField({required: true, blank: true, initial: "0"}),
        reflec: new fields.StringField({required: true, blank: true, initial: "0"}),
        ablat: new fields.StringField({required: true, blank: true, initial: "0"}),
        combat: new fields.StringField({required: true, blank: true, initial: "0"})
      }),
      range: new fields.SchemaField({
        close: new fields.StringField({required: true, blank: true, initial: "0"}),
        short: new fields.StringField({required: true, blank: true, initial: "0"}),
        medium: new fields.StringField({required: true, blank: true, initial: "0"}),
        long: new fields.StringField({required: true, blank: true, initial: "0"}),
        veryLong: new fields.StringField({required: true, blank: true, initial: "0"})
      })
    });
    return schema;
  }

  /**
   * @param {object} source
   * @returns {object}
   */
  static migrateData(source) {
    if ("ammo" in source) {
      migrateStringToNumber(source, "ammo");
      if (!Number.isInteger(source.ammo)) {
        source.ammo = Math.trunc(source.ammo);
      }
      if (source.ammo < 0) {
        source.ammo = 0;
      }
    }
    if ("armorPiercing" in source) {
      if (typeof source.armorPiercing !== 'string') {
        migrateNumberToString(source, 'armorPiercing');
      }
    }
    return super.migrateData(source);
  }
}
