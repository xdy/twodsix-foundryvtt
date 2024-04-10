// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { makeResourceField, makeValueField} from "./commonSchemaUtils";
import { GearData, makeTargetTemplate, TwodsixItemBaseData } from "./item-base";

const fields = foundry.data.fields;
const requiredInteger = { required: true, nullable: false, integer: true };
const requiredBlankString = {required: true, blank: true, initial: "" };

export class EquipmentToolData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.useConsumableForAttack = new fields.StringField({...requiredBlankString});
    return schema;
  }
}

export class WeaponData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.target = makeTargetTemplate();
    schema.range = new fields.StringField({...requiredBlankString});
    schema.damage = new fields.StringField({required: true, blank: true, initial: "3d6" });
    schema.damageBonus = new fields.NumberField({required: true, nullable: true, integer: true, initial: 0});
    schema.magazineSize = new fields.NumberField({...requiredInteger, initial: 0});
    schema.ammo = new fields.NumberField({...requiredInteger, initial: 0}); //;new fields.StringField({...requiredBlankString});
    schema.useConsumableForAttack = new fields.StringField({...requiredBlankString});
    schema.magazineCost = new fields.NumberField({required: true, nullable: false, integer: false , initial: 0});
    schema.lawLevel = new fields.StringField({...requiredBlankString});//new fields.NumberField({required: true, nullable: true, integer: true , initial: 0});
    schema.rangeBand = new fields.StringField({required: true, blank: false, initial: "none" });
    schema.weaponType = new fields.StringField({...requiredBlankString});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "NONE" });
    schema.rateOfFire = new fields.StringField({...requiredBlankString});
    schema.doubleTap = new fields.BooleanField({ required: true, initial: false});
    schema.recoil = new fields.BooleanField({ required: true, initial: false});
    schema.features = new fields.StringField({...requiredBlankString});
    schema.armorPiercing = new fields.NumberField({...requiredInteger, initial: 0});
    schema.handlingModifiers = new fields.StringField({...requiredBlankString});
    schema.meleeRangeModifier = new fields.StringField({ required: true, blank: true, initial: "0"});
    schema.customCT = new fields.SchemaField({
      armor: new fields.SchemaField({
        nothing: new fields.StringField({ required: true, blank: true, initial: "0"}),
        jack: new fields.StringField({ required: true, blank: true, initial: "0"}),
        mesh: new fields.StringField({ required: true, blank: true, initial: "0"}),
        cloth: new fields.StringField({ required: true, blank: true, initial: "0"}),
        reflec: new fields.StringField({ required: true, blank: true, initial: "0"}),
        ablat: new fields.StringField({ required: true, blank: true, initial: "0"}),
        combat: new fields.StringField({ required: true, blank: true, initial: "0"})
      }),
      range: new fields.SchemaField({
        close: new fields.StringField({ required: true, blank: true, initial: "0"}),
        short: new fields.StringField({ required: true, blank: true, initial: "0"}),
        medium: new fields.StringField({ required: true, blank: true, initial: "0"}),
        long: new fields.StringField({ required: true, blank: true, initial: "0"}),
        veryLong: new fields.StringField({ required: true, blank: true, initial: "0"})
      })
    });
    return schema;
  }
  /*static migrateData(source:any) {
    migrateStringToNumber(source, "ammo");
  }*/
}

export class ArmorData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.armor = new fields.NumberField({...requiredInteger, initial: 0});
    schema.secondaryArmor = new fields.SchemaField({
      value: new fields.NumberField({...requiredInteger, initial: 0}),
      protectionTypes: new fields.ArrayField(new fields.StringField({blank: false}))
    });
    schema.radiationProtection = makeValueField(0);
    schema.useConsumableForAttack = new fields.StringField({...requiredBlankString});
    schema.isPowered = new fields.BooleanField({ required: true, initial: false});
    schema.nonstackable = new fields.BooleanField({ required: true, initial: false});
    schema.armorType = new fields.StringField({required: true, blank: false, initial: "nothing" });
    return schema;
  }
}

export class AugmentData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.auglocation = new fields.StringField({required: true, blank: false, initial: "None" });
    schema.bonus = new fields.StringField({required: true, blank: true, initial: "stat increase" });
    return schema;
  }
}

export class TraitData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.value = new fields.NumberField({...requiredInteger, initial: 0});
    schema.shortdescr = new fields.StringField({...requiredBlankString});
    schema.subtype = new fields.StringField({...requiredBlankString});  //Needed?
    schema.prereq = new fields.StringField({...requiredBlankString});
    schema.key = new fields.StringField({required: true, blank: false, initial: "key" }); //Needed?
    return schema;
  }
}

export class SkillData extends TraitData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.value = new fields.NumberField({...requiredInteger, initial: -3});
    schema.characteristic = new fields.StringField({required: true, blank: false, initial: "NONE" });
    schema.difficulty = new fields.StringField({required: true, blank: false, initial: "Average" });
    schema.rolltype = new fields.StringField({required: true, blank: false, initial: "Normal" }); ///Probably should be rollType
    schema.trainingNotes = new fields.StringField({...requiredBlankString});
    schema.groupLabel = new fields.StringField({...requiredBlankString});
    return schema;
  }
}

export class SpellData extends TraitData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.target = makeTargetTemplate();
    schema.circle = new fields.StringField({...requiredBlankString});
    schema.duration = new fields.StringField({...requiredBlankString});
    schema.associatedSkillName = new fields.StringField({...requiredBlankString});
    schema.damage = new fields.StringField({...requiredBlankString});
    return schema;
  }
}

export class ConsumableData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.currentCount = new fields.NumberField({...requiredInteger, initial: 1});
    schema.max = new fields.NumberField({...requiredInteger, initial: 0});
    schema.subtype = new fields.StringField({required: true, blank: false, initial: "other" });
    schema.armorPiercing = new fields.NumberField({...requiredInteger, initial: 0});
    schema.bonusDamage = new fields.StringField({...requiredBlankString});
    schema.isAttachment = new fields.BooleanField({ required: true, initial: false});
    schema.bandwidth = new fields.NumberField({...requiredInteger, initial: 0});
    schema.softwareActive = new fields.BooleanField({ required: true, initial: true});
    schema.damageType = new fields.StringField({required: true, blank: false, initial: "NONE" });
    schema.parentName = new fields.StringField({...requiredBlankString});
    return schema;
  }
}

export class ComponentData extends GearData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.subtype = new fields.StringField({required: true, blank: false, initial: "otherInternal" });
    schema.powerDraw = new fields.NumberField({...requiredInteger, initial: 0});
    schema.rating = new fields.StringField({...requiredBlankString});
    schema.availableQuantity = new fields.StringField({...requiredBlankString});
    schema.hits = new fields.NumberField({...requiredInteger, initial: 0});
    schema.damage = new fields.StringField({...requiredBlankString});
    schema.radDamage = new fields.StringField({...requiredBlankString});
    schema.range = new fields.StringField({...requiredBlankString});
    schema.status = new fields.StringField({required: true, blank: false, initial: "operational" });
    schema.weightIsPct = new fields.BooleanField({ required: true, initial: false});
    schema.isIllegal = new fields.BooleanField({ required: true, initial: false});
    schema.purchasePrice = new fields.NumberField({required: true, nullable: false, integer: false, initial: 0});//new fields.StringField({...requiredBlankString});
    schema.cargoLocation = new fields.StringField({...requiredBlankString});
    schema.generatesPower = new fields.BooleanField({ required: true, initial: false});
    schema.isRefined = new fields.BooleanField({ required: true, initial: false});
    schema.features = new fields.StringField({...requiredBlankString});
    schema.pricingBasis = new fields.StringField({required: true, blank: false, initial: "perUnit" });
    schema.powerBasis = new fields.StringField({required: true, blank: false, initial: "perUnit" });
    schema.isBaseHull = new fields.BooleanField({ required: true, initial: false});
    schema.rollModifier = new fields.StringField({...requiredBlankString});
    schema.rateOfFire = new fields.StringField({...requiredBlankString});
    schema.armorPiercing = new fields.NumberField({...requiredInteger, initial: 0});
    schema.actorLink = new fields.StringField({...requiredBlankString});
    schema.hardened = new fields.BooleanField({ required: true, initial: false});
    schema.ammunition = makeResourceField(0, 0);
    schema.isPopup = new fields.BooleanField({ required: true, initial: false});
    schema.isExtended = new fields.BooleanField({ required: true, initial: false});
    schema.bandwidth = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
  /*static migrateData(source:any) {
    migrateStringToNumber(source, "purchasePrice");
  }*/
}

export class ShipPositionData extends TwodsixItemBaseData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.name = new fields.StringField({...requiredBlankString});
    schema.icon = new fields.StringField({...requiredBlankString});
    schema.actions =  new fields.ObjectField({required: true, initial: {}});;
    schema.order = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}

export class ComputerData extends EquipmentToolData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.processingPower = new fields.NumberField({...requiredInteger, initial: 0});
    return schema;
  }
}

export class JunkStorageData extends EquipmentToolData {
  static defineSchema() {
    const schema = super.defineSchema();
    schema.priorType = new fields.StringField({required: true, blank: false, initial: "unknown"});
    return schema;
  }
}
