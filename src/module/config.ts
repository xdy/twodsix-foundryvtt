// Namespace TWODSIX Configuration Values


const CHARACTERISTICS = Object.freeze({
  "strength": "STR",
  "dexterity": "DEX",
  "endurance": "END",
  "intelligence": "INT",
  "education": "EDU",
  "socialStanding": "SOC",
  "psionicStrength": "PSI",
  "stamina": "STA",
  "lifeblood": "LFB",
  "alternative1": "ALT1",
  "alternative2": "ALT2"
});

/**
 * Rules variants one can use.
 * Note that only variants that actually have different rules implementations are listed here.
 * @type {Object}
 */
const VARIANTS = Object.freeze({
  "CE": "CE",
  "CEL": "CEL",
});

//TODO VARIANTS and RULESETS should really be combined/refactored.
/**
 * Sets of Twodsix settings that best match each supported ruleset.
 */
const RULESETS = Object.freeze({
  CE: {
    key: "CE",
    name: "Cepheus Engine",
    settings: {
      initiativeFormula: "2d6 + @characteristics.dexterity.mod",
      difficultyListUsed: "CE",
      difficultiesAsTargetNumber: false,
      autofireRulesUsed: "CE",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: false,
      absoluteCriticalEffectValue: 99,
      ShowLawLevel: true,
      ShowRangeBandAndHideRange: true,
      ShowWeaponType: true,
      ShowDamageType: true,
      ShowRateOfFire: true,
      ShowRecoil: true,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      mortgagePayment: 240,
      massProductionDiscount: 0.10,
      maxEncumbrance: "12 * @characteristics.strength.current",
      defaultMovement: 6,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "1d6",
      showTimeframe: true,
      showHullAndArmor: "armorHullStruc"
    }
  },
  CEL: {
    key: "CEL",
    name: "Cepheus Light",
    settings: {
      initiativeFormula: "2d6 + @skills.Tactics_",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      mortgagePayment: 240,
      massProductionDiscount: 0.10,
      maxEncumbrance: "3 * @characteristics.strength.value",
      defaultMovement: 9,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold"
    }
  },
  CEFTL: {
    key: "CEFTL",
    name: "Cepheus Faster Than Light",
    settings: {
      initiativeFormula: "2d6",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CE",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      maxEncumbrance: "0",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold"
    },
  },
  CEATOM: {
    key: "CEATOM",
    name: "Cepheus Atom",
    settings: {
      initiativeFormula: "2d6",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CE",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      lifebloodInsteadOfCharacteristics: true,
      showLifebloodStamina: false,
      showContaminationBelowLifeblood: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -1,
      maxEncumbrance: "2 * @characteristics.endurance.value",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold"
    }
  },
  BARBARIC: {
    key: "BARBARIC",
    name: "Barbaric!",
    settings: {
      initiativeFormula: "2d6",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CE",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 4,
      lifebloodInsteadOfCharacteristics: true,
      showLifebloodStamina: false,
      showContaminationBelowLifeblood: false,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -1,
      maxEncumbrance: "2 * @characteristics.endurance.value",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      unarmedDamage: "1d6",
      showTimeframe: false
    },
  },
  CEQ: {
    key: "CEQ",
    name: "Cepheus Quantum",
    settings: {
      initiativeFormula: "1d1",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CE",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: false,
      absoluteCriticalEffectValue: 99,
      lifebloodInsteadOfCharacteristics: true,
      showLifebloodStamina: false,
      showContaminationBelowLifeblood: false,
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      maxEncumbrance: "0",
      defaultMovement: 9,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold"
    }
  },
  CD: {
    key: "CD",
    name: "Cepheus Deluxe",
    settings: {
      initiativeFormula: "2d6 + @skills.Tactics + @characteristics.intelligence.mod",
      difficultyListUsed: "CE",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      showLifebloodStamina: true,
      lifebloodInsteadOfCharacteristics: false,
      showContaminationBelowLifeblood: false,
      ShowLawLevel: false,
      ShowRangeBandAndHideRange: false,
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -2,
      mortgagePayment: 320,
      massProductionDiscount: 0.10,
      maxEncumbrance: "3 * (7 + @characteristics.strength.mod)",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "armorOnly"
    }
  },
  CLU: {
    key: "CLU",
    name: "Cepheus Light Upgraded",
    settings: {
      initiativeFormula: "2d6",
      difficultyListUsed: "CE",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      showLifebloodStamina: true,
      lifebloodInsteadOfCharacteristics: false,
      showContaminationBelowLifeblood: false,
      ShowLawLevel: false,
      ShowRangeBandAndHideRange: false,
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -2,
      mortgagePayment: 320,
      massProductionDiscount: 0.10,
      maxEncumbrance: "3*(7 + @characteristics.strength.mod)",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "armorOnly"
    }
  },

  OTHER: {
    key: "OTHER",
    name: "Other",
    settings: {}
  }
})
;

const ROLLTYPES = Object.freeze({
  Advantage: {key: 'Advantage', formula: "3d6kh2"},
  Normal: {key: 'Normal', formula: "2d6"},
  Disadvantage: {key: 'Disadvantage', formula: "3d6kl2"}
});

const CONSUMABLES = Object.freeze([
  "air", "drugs", "food", "fuel", "magazine", "power_cell", "other"
]);

export type CE_DIFFICULTIES = { Formidable:{ mod:number; target:number }; Easy:{ mod:number; target:number }; Difficult:{ mod:number; target:number }; Average:{ mod:number; target:number }; VeryDifficult:{ mod:number; target:number }; Routine:{ mod:number; target:number }; Impossible:{ mod:number; target:number }; Simple:{ mod:number; target:number } };
export type CEL_DIFFICULTIES = { Formidable:{ mod:number; target:number }; Difficult:{ mod:number; target:number }; Average:{ mod:number; target:number }; VeryDifficult:{ mod:number; target:number }; Routine:{ mod:number; target:number } };
const DIFFICULTIES:Readonly<{ CE:CE_DIFFICULTIES; CEL:CEL_DIFFICULTIES }> = Object.freeze({
  CE: {
    Simple: {mod: 6, target: 2},
    Easy: {mod: 4, target: 4},
    Routine: {mod: 2, target: 6},
    Average: {mod: 0, target: 8},
    Difficult: {mod: -2, target: 10},
    VeryDifficult: {mod: -4, target: 12},
    Formidable: {mod: -6, target: 14},
    Impossible: {mod: -8, target: 16},
  },
  CEL: {
    Routine: {mod: 2, target: 4},
    Average: {mod: 0, target: 6},
    Difficult: {mod: -2, target: 8},
    VeryDifficult: {mod: -4, target: 10},
    Formidable: {mod: -6, target: 12},
  }
});

export const SHIP_ACTION_TYPE = Object.freeze({
  skillRoll: "skillRoll",
  chatMessage: "chatMessage",
  fireEnergyWeapons: "fireEnergyWeapons"
});

/**
 * The valid units of measure for movement distances in the game system.
 */
export const MovementTypes = {
  burrow: "TWODSIX.Actor.Movement.MovementBurrow",
  climb: "TWODSIX.Actor.Movement.MovementClimb",
  fly: "TWODSIX.Actor.Movement.MovementFly",
  swim: "TWODSIX.Actor.Movement.MovementSwim",
  walk: "TWODSIX.Actor.Movement.MovementWalk"
};

/**
 * The valid units of measure for movement distances in the game system.
 */
export const MovementUnits = {
  ft: "TWODSIX.Actor.Movement.DistFt",
  mi: "TWODSIX.Actor.Movement.DistMi",
  m: "TWODSIX.Actor.Movement.DistM",
  km: "TWODSIX.Actor.Movement.DistKm",
  pc: "TWODSIX.Actor.Movement.DistPc",
  gu: "TWODSIX.Actor.Movement.DistGU"
};

export const MovementUnitsUnLocalized = {
  ft: "Feet",
  mi: "Miles",
  m: "Meters",
  km: "Kilometers",
  pc: "Parsecs",
  gu: "Grid Units"
};

/**
 * The valid pricing bases for components other than base hull.
 */
export const PricingOptions = {
  perUnit: "TWODSIX.Items.Component.perUnit",
  perCompTon: "TWODSIX.Items.Component.perCompTon",
  perHullTon: "TWODSIX.Items.Component.perHullTon",
  pctHull: "TWODSIX.Items.Component.pctHull"
};

/**
 * The valid pricing bases for base hull.
 */
export const HullPricingOptions = {
  perUnit: "TWODSIX.Items.Component.perUnit",
  perCompTon: "TWODSIX.Items.Component.perCompTon",
  perHullTon: "TWODSIX.Items.Component.perHullTon"
};

/**
 * The valid choices for characteristic displays in the game system.
 */
export const CharacteristicDisplayTypes = {
  base: "Base",
  alternate: "Alternate",
  all: "All"
};

/**
 * The valid states for components.
 */
export const ComponentStates = {
  operational: "TWODSIX.Items.Component.operational",
  damaged: "TWODSIX.Items.Component.damaged",
  destroyed: "TWODSIX.Items.Component.destroyed",
  off: "TWODSIX.Items.Component.off"
};

/**
 * The valid types of ship components.
 */
export const ComponentTypes = {
  accomodations: "TWODSIX.Items.Component.accomodations",
  armament: "TWODSIX.Items.Component.armament",
  armor: "TWODSIX.Items.Component.armor",
  bridge: "TWODSIX.Items.Component.bridge",
  cargo: "TWODSIX.Items.Component.cargo",
  computer: "TWODSIX.Items.Component.computer",
  drive: "TWODSIX.Items.Component.drive",
  drone: "TWODSIX.Items.Component.drone",
  electronics: "TWODSIX.Items.Component.electronics",
  fuel: "TWODSIX.Items.Component.fuel",
  hull: "TWODSIX.Items.Component.hull",
  mount: "TWODSIX.Items.Component.mount",
  other: "TWODSIX.Items.Component.other",
  otherExternal: "TWODSIX.Items.Component.otherExternal",
  otherInternal: "TWODSIX.Items.Component.otherInternal",
  power: "TWODSIX.Items.Component.power",
  sensor: "TWODSIX.Items.Component.sensor",
  shield: "TWODSIX.Items.Component.shield",
  software: "TWODSIX.Items.Component.software",
  storage: "TWODSIX.Items.Component.storage",
  vehicle: "TWODSIX.Items.Component.vehicle"
};

/**
 * The valid time units.
 */
export const TimeUnits = {
  none: "TWODSIX.Actor.Skills.Timeframe.none",
  sec: "TWODSIX.Actor.Skills.Timeframe.secs",
  min: "TWODSIX.Actor.Skills.Timeframe.mins",
  hrs: "TWODSIX.Actor.Skills.Timeframe.hrs",
  days: "TWODSIX.Actor.Skills.Timeframe.days",
  weeks: "TWODSIX.Actor.Skills.Timeframe.weeks",
  months: "TWODSIX.Actor.Skills.Timeframe.months",
  rounds: "TWODSIX.Actor.Skills.Timeframe.rounds"
};

/**
 * The vehcile protection types.
 */
export const VehicleProtection = {
  armorOnly: "Armor Only",
  threshold: "Threshold",
  armorHullStruc: "Armor, Hull and Structure"
};

export type TWODSIX = {
  CHARACTERISTICS: typeof CHARACTERISTICS,
  CONSUMABLES: typeof CONSUMABLES,
  VARIANTS: typeof VARIANTS,
  ROLLTYPES: typeof ROLLTYPES,
  DIFFICULTIES: typeof DIFFICULTIES,
  RULESETS: typeof RULESETS,
  SHIP_ACTION_TYPE: typeof SHIP_ACTION_TYPE,
  MovementUnits: typeof MovementUnits,
  MovementUnitsUnLocalized: typeof MovementUnitsUnLocalized,
  MovementType: typeof MovementTypes,
  PricingOptions: typeof PricingOptions,
  HullPricingOptions: typeof HullPricingOptions,
  ComponentStates: typeof ComponentStates,
  ComponentTypes: typeof ComponentTypes,
  CharacteristicDisplayTypes: typeof CharacteristicDisplayTypes,
  TimeUnts: typeof TimeUnits,
  VehicleProtection: typeof VehicleProtection
};

export const TWODSIX = {
  CHARACTERISTICS: CHARACTERISTICS,
  CONSUMABLES: CONSUMABLES,
  VARIANTS: VARIANTS,
  ROLLTYPES: ROLLTYPES,
  DIFFICULTIES: DIFFICULTIES,
  RULESETS: RULESETS,
  SHIP_ACTION_TYPE: SHIP_ACTION_TYPE,
  MovementUnits: MovementUnits,
  MovementUnitsUnLocalized: MovementUnitsUnLocalized,
  MovementType: MovementTypes,
  PricingOptions: PricingOptions,
  HullPricingOptions: HullPricingOptions,
  ComponentStates: ComponentStates,
  ComponentTypes: ComponentTypes,
  CharacteristicDisplayTypes: CharacteristicDisplayTypes,
  TimeUnits: TimeUnits,
  VehicleProtection: VehicleProtection
};

export const EQUIPPED_STATES = ["equipped", "ship", "backpack"];
