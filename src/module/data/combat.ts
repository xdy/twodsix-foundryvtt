// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

const fields = foundry.data.fields;
const requiredInteger = { required: true, nullable: false, integer: true };
const requiredBlankString = { required: true, blank: true, initial: "" };

export class TwodsixCombatData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.currentPhase = new fields.StringField({...requiredBlankString });
    schema.phaseIndex = new fields.NumberField({...requiredInteger, initial: 0});
    schema.isSpaceCombat = new fields.BooleanField({ required: true, initial: false});
    return schema;
  }
}

export class TwodsixCombatantData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.spacePhase = new fields.StringField({ ...requiredBlankString });
    schema.minorActionsUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.significantActionsUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.reactionsUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.reactionsAvailable = new fields.NumberField({...requiredInteger, initial: 0});
    schema.thrustUsed = new fields.NumberField({...requiredInteger, initial: 0});
    schema.thrustAvailable = new fields.NumberField({...requiredInteger, initial: 0});
    schema.hasty = new fields.BooleanField({ required: true, initial: false});
    return schema;
  }
}
