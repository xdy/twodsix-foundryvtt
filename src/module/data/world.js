
const fields = foundry.data.fields;
const requiredInteger = { required: true, nullable: false, integer: true };
const requiredBlankString = { required: true, blank: true, initial: "" };

export class WorldData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const schema = {};
    schema.name = new fields.StringField({ ...requiredBlankString });
    schema.uwp = new fields.StringField({ ...requiredBlankString });
    schema.starport = new fields.StringField({ ...requiredBlankString });
    schema.size = new fields.StringField({ ...requiredBlankString });
    schema.atmosphere = new fields.StringField({ ...requiredBlankString });
    schema.hydrographics = new fields.StringField({ ...requiredBlankString });
    schema.population = new fields.StringField({ ...requiredBlankString });
    schema.government = new fields.StringField({ ...requiredBlankString });
    schema.lawLevel = new fields.StringField({ ...requiredBlankString });
    schema.techLevel = new fields.StringField({ ...requiredBlankString });
    schema.allegiance = new fields.StringField({ ...requiredBlankString });
    //schema.bases = new fields.StringField({ ...requiredBlankString });
    schema.features = new fields.ArrayField(new fields.StringField({blank: false}));
    schema.tradeCodes = new fields.StringField({ ...requiredBlankString });
    schema.travelZone = new fields.StringField({ ...requiredBlankString });
    schema.description = new fields.HTMLField({ ...requiredBlankString });
    schema.worldImage = new fields.StringField({ ...requiredBlankString });
    schema.mainExports = new fields.StringField({ ...requiredBlankString });
    schema.mainImports = new fields.StringField({ ...requiredBlankString });
    schema.economicLevel = new fields.StringField({ ...requiredBlankString });
    schema.marketProfile = new fields.StringField({ ...requiredBlankString });
    schema.localCurrency = new fields.StringField({ ...requiredBlankString });
    schema.portFees = new fields.StringField({ ...requiredBlankString });
    schema.climate = new fields.HTMLField({ ...requiredBlankString });
    schema.hazards = new fields.HTMLField({ ...requiredBlankString });
    schema.specialRules = new fields.HTMLField({ ...requiredBlankString });
    schema.adventureHooks = new fields.HTMLField({ ...requiredBlankString });
    schema.notes = new fields.HTMLField({ ...requiredBlankString });
    schema.relatedActors = new fields.StringField({ ...requiredBlankString });
    // Additional UWP/World fields per Cepheus SRD
    schema.populationModifier = new fields.NumberField({ ...requiredInteger, initial: 0 });
    schema.numPlanetoidBelts = new fields.NumberField({...requiredInteger, initial: 0 });
    schema.numGasGiants = new fields.NumberField({ ...requiredInteger, initial: 0 } );
    return schema;
  }
}
