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
      lifebloodInsteadOfCharacteristics: false
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
      lifebloodInsteadOfCharacteristics: false
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
      lifebloodInsteadOfCharacteristics: false
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
      showContaminationBelowLifeblood: true
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
      showContaminationBelowLifeblood: false
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
      showContaminationBelowLifeblood: false
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
      ShowRecoil: true
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
      ShowRecoil: true
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
  km: "TWODSIX.Actor.Movement.DistKm"
};

/**
 * The valid pricing bases for components.
 */
export const PricingOptions = {
  perUnit: "TWODSIX.Items.Component.perUnit",
  perTon: "TWODSIX.Items.Component.perTon",
  pctHull: "TWODSIX.Items.Component.pctHull"
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
 * The valid states for components.
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

export type TWODSIX = {
  CHARACTERISTICS: typeof CHARACTERISTICS,
  CONSUMABLES: typeof CONSUMABLES,
  VARIANTS: typeof VARIANTS,
  ROLLTYPES: typeof ROLLTYPES,
  DIFFICULTIES: typeof DIFFICULTIES,
  RULESETS: typeof RULESETS,
  SHIP_ACTION_TYPE: typeof SHIP_ACTION_TYPE,
  MovementUnits: typeof MovementUnits,
  MovementType: typeof MovementTypes,
  PricingOptions: typeof PricingOptions,
  ComponentStates: typeof ComponentStates,
  ComponentTypes: typeof ComponentTypes,
  CharacteristicDisplayTypes: typeof CharacteristicDisplayTypes
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
  MovementType: MovementTypes,
  PricingOptions: PricingOptions,
  ComponentStates: ComponentStates,
  ComponentTypes: ComponentTypes,
  CharacteristicDisplayTypes: CharacteristicDisplayTypes
};

export const EQUIPPED_STATES = ["equipped", "ship", "backpack"];

