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
  "alternative2": "ALT2",
  "alternative3": "ALT3"
});

/**
 * Difficulty variants one can use.
 * Note that only variants that actually have different rules implementations are listed here.
 * @type {Object}
 */
const DIFFICULTY_VARIANTS = Object.freeze({
  "CE": "CE",
  "CEL": "CEL",
});

/**
 * Autofire variants one can use.
 * Note that only variants that actually have different rules implementations are listed here.
 * @type {Object}
 */
const AUTOFIRE_VARIANTS = Object.freeze({
  "CE": "CE",
  "CEL": "CEL",
  "CT": "CT"
});

//TODO VARIANTS and RULESETS should really be combined/refactored.
/**
 * Sets of Twodsix settings that best match each supported ruleset.
 */
const RULESETS = Object.freeze({
  CT: {
    key: "CT",
    name: "Classic Traveller",
    settings: {
      initiativeFormula: "2d6 + @characteristics.dexterity.value/100",
      difficultyListUsed: "CE",
      difficultiesAsTargetNumber: false,
      autofireRulesUsed: "CT",
      modifierForZeroCharacteristic: 0,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: false,
      absoluteCriticalEffectValue: 99,
      ShowLawLevel: true,
      rangeModifierType: "CT_Bands",
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      ShowDoubleTap: false,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      mortgagePayment: 240,
      massProductionDiscount: "0.10",
      maxEncumbrance: "3000 * @characteristics.strength.value",
      defaultMovement: 25,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "1d6",
      showTimeframe: false,
      showHullAndArmor: "armorHullStruc",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: true,
      showComponentRating: true,
      showComponentDM: true,
      encumbranceFraction: "0.33334",
      encumbranceModifier: -1,
      useDegreesOfSuccess: 'none',
      targetDMList: "Cover (full) -4, Evade (short) -1, Evade (medium) -2, Evade (long) -4, Darkness (total) -9, Darkness (partial) -6",
      armorDamageFormula: "@damage",
      addEffectToDamage: false,
      addEffectToManualDamage: false,
      weightModifierForWornArmor: "0"
    }
  },
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
      rangeModifierType: "CE_Bands",
      ShowWeaponType: true,
      ShowDamageType: true,
      ShowRateOfFire: true,
      ShowRecoil: true,
      ShowDoubleTap: false,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      mortgagePayment: 240,
      massProductionDiscount: "0.10",
      maxEncumbrance: "12 * @characteristics.strength.current",
      defaultMovement: 6,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "1d6",
      showTimeframe: true,
      showHullAndArmor: "armorHullStruc",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: true,
      showComponentRating: true,
      showComponentDM: true,
      encumbranceFraction: "0.1667",
      encumbranceModifier: -1,
      useDegreesOfSuccess: 'CE',
      targetDMList: "Aiming +1, Cover (half) -1, Cover (three quarter) -2, Cover (full) -4, Movement -1, Dodges -1, Prone (ranged) -2, Prone (melee) +2, Recoil in Zero G -2",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
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
      ShowDoubleTap: true,
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
      massProductionDiscount: "0.10",
      maxEncumbrance: "3 * @characteristics.strength.value",
      defaultMovement: 9,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: false,
      showComponentRating: true,
      showComponentDM: true,
      encumbranceFraction: "0.334",
      encumbranceModifier: -1,
      useDegreesOfSuccess: 'none',
      targetDMList: "Obscured -1, Cover (hard) -2, Cover (heavy) -3, Cover (total) -4, Running -1, Prone (ranged) -2, Darkness -2, Dim Light -1, Shield -1, Overwatch w/Shield -2",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    }
  },
  CEFTL: {
    key: "CEFTL",
    name: "Cepheus Faster Than Light",
    settings: {
      initiativeFormula: "2d6 + @skills.Tactics",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      ShowDoubleTap: false,
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      rangeModifierType: "doubleBand",
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      maxEncumbrance: "0",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: false,
      showComponentRating: false,
      showComponentDM: false,
      encumbranceFraction: "0.334",
      encumbranceModifier: 0,
      useDegreesOfSuccess: 'none',
      targetDMList: "Obscured -1, Cover (hard) -2, Cover (heavy) -3, Cover (total) -4, Running -1, Prone (ranged) -2, Darkness -2, Dim Light -1, Shield -1, Overwatch w/Shield -2",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    },
  },
  CEATOM: {
    key: "CEATOM",
    name: "Cepheus Atom",
    settings: {
      initiativeFormula: "2d6 + @skills.Combat",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      ShowDoubleTap: false,
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      lifebloodInsteadOfCharacteristics: true,
      showLifebloodStamina: false,
      showContaminationBelowLifeblood: true,
      rangeModifierType: "doubleBand",
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -1,
      maxEncumbrance: "2 * @characteristics.endurance.value",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold",
      showSpells: false,
      useNationality: true,
      animalsUseHits: false,
      robotsUseHits: true,
      animalsUseLocations: true,
      displayReactionMorale: true,
      showComponentRating: false,
      showComponentDM: false,
      encumbranceFraction: "0.5",
      encumbranceModifier: 0,
      useDegreesOfSuccess: 'none',
      targetDMList: "",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    }
  },
  BARBARIC: {
    key: "BARBARIC",
    name: "Barbaric!",
    settings: {
      initiativeFormula: "2d6 + @skills.Combat",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CE",
      ShowDoubleTap: false,
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 4,
      lifebloodInsteadOfCharacteristics: true,
      showLifebloodStamina: false,
      showContaminationBelowLifeblood: false,
      rangeModifierType: "doubleBand",
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -1,
      maxEncumbrance: "2 * @characteristics.endurance.value",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      unarmedDamage: "1d6",
      showTimeframe: false,
      showSpells: true,
      useNationality: true,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: true,
      displayReactionMorale: true,
      showComponentRating: false,
      showComponentDM: false,
      encumbranceFraction: "0.5",
      encumbranceModifier: 0,
      useDegreesOfSuccess: 'none',
      targetDMList: "",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
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
      ShowDoubleTap: false,
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: false,
      absoluteCriticalEffectValue: 99,
      lifebloodInsteadOfCharacteristics: true,
      showLifebloodStamina: false,
      showContaminationBelowLifeblood: false,
      rangeModifierType: "doubleBand",
      minorWoundsRollModifier: 0,
      seriousWoundsRollModifier: 0,
      maxEncumbrance: "0",
      defaultMovement: 9,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "threshold",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: false,
      showComponentRating: false,
      showComponentDM: false,
      encumbranceFraction: "0.334",
      encumbranceModifier: 0,
      useDegreesOfSuccess: 'none',
      targetDMList: "",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true
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
      ShowDoubleTap: true,
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
      rangeModifierType: "doubleBand",
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -2,
      mortgagePayment: 320,
      massProductionDiscount: "0.10",
      maxEncumbrance: "3 * (7 + @characteristics.strength.mod)",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "armorOnly",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: true,
      showComponentRating: true,
      showComponentDM: true,
      encumbranceFraction: "0.334",
      encumbranceModifier: -2,
      useDegreesOfSuccess: 'none',
      targetDMList: "Obscured -1, Cover (hard) -2, Cover (heavy) -3, Cover (total) -4, Running -1, Prone (ranged) -2, Darkness -2, Dim Light -1, Shield -1, Overwatch w/Shield -2",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    }
  },
  CDEE: {
    key: "CDEE",
    name: "Cepheus Deluxe Enhanced Edition",
    settings: {
      initiativeFormula: "2d6 + @skills.Tactics + @characteristics.intelligence.mod",
      difficultyListUsed: "CE",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      ShowDoubleTap: true,
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
      rangeModifierType: "doubleBand",
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -2,
      mortgagePayment: 320,
      massProductionDiscount: "0.10",
      maxEncumbrance: "3 * (7 + @characteristics.strength.mod)",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "armorOnly",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: true,
      showComponentRating: true,
      showComponentDM: true,
      encumbranceFraction: "0.334",
      encumbranceModifier: -2,
      useDegreesOfSuccess: 'none',
      targetDMList: "Obscured -1, Cover (hard) -2, Cover (heavy) -3, Cover (total) -4, Running -1, Prone (ranged) -2, Darkness -2, Dim Light -1, Shield -1, Overwatch w/Shield -2",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    }
  },
  CLU: {
    key: "CLU",
    name: "Cepheus Light Upgraded",
    settings: {
      initiativeFormula: "2d6 + @skills.Tactics + @characteristics.intelligence.mod",
      difficultyListUsed: "CE",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      ShowDoubleTap: true,
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
      rangeModifierType: "doubleBand",
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -2,
      mortgagePayment: 320,
      massProductionDiscount: "0.10",
      maxEncumbrance: "3*(7 + @characteristics.strength.mod)",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "armorOnly",
      showSpells: false,
      useNationality: false,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: true,
      showComponentRating: true,
      showComponentDM: true,
      encumbranceFraction: "0.334",
      encumbranceModifier: -2,
      useDegreesOfSuccess: 'none',
      targetDMList: "Obscured -1, Cover (hard) -2, Cover (heavy) -3, Cover (total) -4, Running -1, Prone (ranged) -2, Darkness -2, Dim Light -1, Shield -1, Overwatch w/Shield -2",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    }
  },
  SOC: {
    key: "SOC",
    name: "The Sword of Cepheus",
    settings: {
      initiativeFormula: "2d6 + @skills.Tactics",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CE",
      ShowDoubleTap: false,
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99,
      showLifebloodStamina: false,
      lifebloodInsteadOfCharacteristics: false,
      showContaminationBelowLifeblood: false,
      ShowLawLevel: false,
      rangeModifierType: "doubleBand",
      ShowWeaponType: true,
      ShowDamageType: false,
      ShowRateOfFire: true,
      ShowRecoil: true,
      minorWoundsRollModifier: -1,
      seriousWoundsRollModifier: -2,
      mortgagePayment: 240,
      massProductionDiscount: "0.10",
      maxEncumbrance: "3*(@characteristics.strength.value)",
      defaultMovement: 10,
      defaultMovementUnits: "m",
      addEffectForShipDamage: false,
      unarmedDamage: "max(@characteristics.strength.mod, 1)",
      showTimeframe: false,
      showHullAndArmor: "armorOnly",
      showSpells: true,
      useNationality: true,
      animalsUseHits: false,
      robotsUseHits: false,
      animalsUseLocations: false,
      displayReactionMorale: true,
      showComponentRating: false,
      showComponentDM: false,
      encumbranceFraction: "0.334",
      encumbranceModifier: -1,
      useDegreesOfSuccess: 'none',
      targetDMList: "Obscured -1, Cover (good) -2, Cover (heavy) -3, Cover (total) -4, Running -1, Prone (ranged) -2, Darkness -2, Dim Light -1, Shield -1",
      armorDamageFormula: "@damage - @effectiveArmor",
      addEffectToDamage: true,
      weightModifierForWornArmor: "1"
    }
  },
  OTHER: {
    key: "OTHER",
    name: "Other",
    settings: {
      useDegreesOfSuccess: 'other',
      rangeModifierType: "singleBand",
      armorDamageFormula: "@damage - @effectiveArmor",
    },
  }
})
;

const ROLLTYPES = Object.freeze({
  Advantage: {key: 'Advantage', formula: "3d6kh2"},
  Normal: {key: 'Normal', formula: "2d6"},
  Disadvantage: {key: 'Disadvantage', formula: "3d6kl2"}
});

const CONSUMABLES = Object.freeze({
  air: "TWODSIX.Items.Consumable.Types.air",
  drugs: "TWODSIX.Items.Consumable.Types.drugs",
  food: "TWODSIX.Items.Consumable.Types.food",
  fuel: "TWODSIX.Items.Consumable.Types.fuel",
  magazine: "TWODSIX.Items.Consumable.Types.magazine",
  power_cell: "TWODSIX.Items.Consumable.Types.power_cell",
  software: "TWODSIX.Items.Consumable.Types.software",
  processor: "TWODSIX.Items.Consumable.Types.processor",
  other: "TWODSIX.Items.Consumable.Types.other"
});

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
  fireEnergyWeapons: "fireEnergyWeapons",
  executeMacro: "executeMacro"
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

/**
 * The valid target Area Types in the game system.
 */
export const areaTargetTypes = {
  none: {
    label: "TWODSIX.Target.None",
    template: ""
  },
  radius: {
    label: "TWODSIX.Target.Radius",
    template: "circle"
  },
  sphere: {
    label: "TWODSIX.Target.Sphere",
    template: "circle"
  },
  cylinder: {
    label: "TWODSIX.Target.Cylinder",
    template: "circle"
  },
  cone: {
    label: "TWODSIX.Target.Cone",
    template: "cone"
  },
  square: {
    label: "TWODSIX.Target.Square",
    template: "rect"
  },
  cube: {
    label: "TWODSIX.Target.Cube",
    template: "rect"
  },
  line: {
    label: "TWODSIX.Target.Line",
    template: "ray"
  },
  wall: {
    label: "TWODSIX.Target.Wall",
    template: "ray"
  }
};

/**
 * The valid pricing bases for components other than base hull.
 */
export const PricingOptions = {
  perUnit: "TWODSIX.Items.Component.perUnit",
  perCompTon: "TWODSIX.Items.Component.perCompTon",
  perHullTon: "TWODSIX.Items.Component.perHullTon",
  per100HullTon: "TWODSIX.Items.Component.per100HullTon",
  pctHull: "TWODSIX.Items.Component.pctHull",
  pctHullPerUnit: "TWODSIX.Items.Component.pctHullPerUnit"
};

/**
 * The valid power bases for components other than base hull.
 */
export const PowerOptions = {
  perUnit: "TWODSIX.Items.Component.powerPerUnit",
  perCompTon: "TWODSIX.Items.Component.powerPerCompTon",
  perHullTon: "TWODSIX.Items.Component.powerPerHullTon"
};

/**
 * The valid pricing bases for base hull.
 */
export const HullPricingOptions = {
  perUnit: "TWODSIX.Items.Component.perUnit",
  perCompTon: "TWODSIX.Items.Component.perCompTon",
  perHullTon: "TWODSIX.Items.Component.perHullTon",
  per100HullTon: "TWODSIX.Items.Component.per100HullTon"
};

/**
 * The valid choices for characteristic displays in the game system.
 */
export const CharacteristicDisplayTypes = {
  core: "TWODSIX.Actor.CharDisplay.Core",
  base: "TWODSIX.Actor.CharDisplay.Base",
  alternate: "TWODSIX.Actor.CharDisplay.Alternate",
  all: "TWODSIX.Actor.CharDisplay.All"
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
  dock: "TWODSIX.Items.Component.dock",
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
 * The vehicle protection types.
 */
export const VehicleProtection = {
  armorOnly: "TWODSIX.Vehicle.ProtectionType.ArmorOnly",
  threshold: "TWODSIX.Vehicle.ProtectionType.Threshold",
  armorHullStruc: "TWODSIX.Vehicle.ProtectionType.ArmorHullStruc"
};

/**
 * The animal types.
 */
export const AnimalNiche = {
  herbivore: "TWODSIX.Animal.NicheType.Herbivore",
  omnivore: "TWODSIX.Animal.NicheType.Omnivore",
  carnivore: "TWODSIX.Animal.NicheType.Carnivore",
  scavenger: "TWODSIX.Animal.NicheType.Scavenger",
  other: "TWODSIX.Animal.NicheType.Other"
};
export const HerbivoreType = {
  filter: "TWODSIX.Animal.Subtype.Filter",
  intermittent: "TWODSIX.Animal.Subtype.Intermittent",
  grazer: "TWODSIX.Animal.Subtype.Grazer"
};
export const OmnivoreType = {
  gatherer: "TWODSIX.Animal.Subtype.Gatherer",
  hunter: "TWODSIX.Animal.Subtype.Hunter",
  eater: "TWODSIX.Animal.Subtype.Eater"
};
export const CarnivoreType = {
  pouncer: "TWODSIX.Animal.Subtype.Pouncer",
  chaser: "TWODSIX.Animal.Subtype.Chaser",
  trapper: "TWODSIX.Animal.Subtype.Trapper",
  siren: "TWODSIX.Animal.Subtype.Siren",
  killer: "TWODSIX.Animal.Subtype.Killer"
};
export const ScavengerType = {
  hijacker: "TWODSIX.Animal.Subtype.Hijacker",
  intimidator: "TWODSIX.Animal.Subtype.Intimidator",
  carrionEater: "TWODSIX.Animal.Subtype.CarrionEater",
  reducer: "TWODSIX.Animal.Subtype.Reducer"
};

export const AnimalLocations = {
  city: "TWODSIX.Animal.Locations.CityUrban",
  plains: "TWODSIX.Animal.Locations.PlainsGrassland",
  hills: "TWODSIX.Animal.Locations.HillsMountains",
  desert: "TWODSIX.Animal.Locations.DesertBadlands",
  swamp: "TWODSIX.Animal.Locations.SwampAquatic",
  forest: "TWODSIX.Animal.Locations.ForestJungle"
};

export const SuccessTypes = {
  none: "TWODSIX.Chat.Roll.DegreesOfSuccess.none",
  CE: "TWODSIX.Chat.Roll.DegreesOfSuccess.CE",
  other: "TWODSIX.Chat.Roll.DegreesOfSuccess.other"
};

export const AllAnimalTypes = Object.assign({}, HerbivoreType, OmnivoreType, CarnivoreType, ScavengerType);

export const EQUIPPED_STATES = {
  backpack: "TWODSIX.Actor.Items.LocationState.backpack",
  equipped: "TWODSIX.Actor.Items.LocationState.equipped",
  vehicle: "TWODSIX.Actor.Items.LocationState.vehicle",
  ship: "TWODSIX.Actor.Items.LocationState.ship",
  base: "TWODSIX.Actor.Items.LocationState.base"
};

export const EQUIPPED_TOGGLE_OPTIONS = {
  core: "TWODSIX.Actor.Items.LocationState.core",
  default: "TWODSIX.Actor.Items.LocationState.default",
  all: "TWODSIX.Actor.Items.LocationState.all",
};

export const RANGE_MODIFIERS_TYPES = {
  none: "TWODSIX.Chat.Roll.RangeModifierTypes.none",
  CT_Bands: "TWODSIX.Chat.Roll.RangeModifierTypes.CT_Bands",
  CE_Bands: "TWODSIX.Chat.Roll.RangeModifierTypes.CE_Bands",
  singleBand: "TWODSIX.Chat.Roll.RangeModifierTypes.singleBand",
  doubleBand: "TWODSIX.Chat.Roll.RangeModifierTypes.doubleBand"
};

export const CE_WEAPON_RANGE_TYPES = {
  long: {
    closeQuarters: "TWODSIX.Chat.Roll.WeaponRangeTypes.closeQuarters",
    extendedReach: "TWODSIX.Chat.Roll.WeaponRangeTypes.extendedReach",
    thrown: "TWODSIX.Chat.Roll.WeaponRangeTypes.thrown",
    pistol: "TWODSIX.Chat.Roll.WeaponRangeTypes.pistol",
    rifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.rifle",
    shotgun: "TWODSIX.Chat.Roll.WeaponRangeTypes.shotgun",
    assaultWeapon: "TWODSIX.Chat.Roll.WeaponRangeTypes.assaultWeapon",
    rocket: "TWODSIX.Chat.Roll.WeaponRangeTypes.rocket",
    none: "TWODSIX.Chat.Roll.WeaponRangeTypes.none"
  },
  short: {
    closeQuarters: "TWODSIX.Chat.Roll.WeaponRangeTypes.CQ",
    extendedReach: "TWODSIX.Chat.Roll.WeaponRangeTypes.reach",
    thrown: "TWODSIX.Chat.Roll.WeaponRangeTypes.thrown",
    pistol: "TWODSIX.Chat.Roll.WeaponRangeTypes.pistol",
    rifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.rifle",
    shotgun: "TWODSIX.Chat.Roll.WeaponRangeTypes.shotgun",
    assaultWeapon: "TWODSIX.Chat.Roll.WeaponRangeTypes.AW",
    rocket: "TWODSIX.Chat.Roll.WeaponRangeTypes.rocket",
    none: "TWODSIX.Chat.Roll.WeaponRangeTypes.none"
  }
};

export const CT_WEAPON_RANGE_TYPES = {
  long: {
    hands: "TWODSIX.Chat.Roll.WeaponRangeTypes.hands",
    claws: "TWODSIX.Chat.Roll.WeaponRangeTypes.claws",
    teeth: "TWODSIX.Chat.Roll.WeaponRangeTypes.teeth",
    horns: "TWODSIX.Chat.Roll.WeaponRangeTypes.horns",
    hooves: "TWODSIX.Chat.Roll.WeaponRangeTypes.hooves",
    stinger: "TWODSIX.Chat.Roll.WeaponRangeTypes.stinger",
    thrasher: "TWODSIX.Chat.Roll.WeaponRangeTypes.thrasher",
    club: "TWODSIX.Chat.Roll.WeaponRangeTypes.club",
    dagger: "TWODSIX.Chat.Roll.WeaponRangeTypes.dagger",
    blade: "TWODSIX.Chat.Roll.WeaponRangeTypes.blade",
    foil: "TWODSIX.Chat.Roll.WeaponRangeTypes.foil",
    cutlass: "TWODSIX.Chat.Roll.WeaponRangeTypes.cutlass",
    sword: "TWODSIX.Chat.Roll.WeaponRangeTypes.sword",
    broadsword: "TWODSIX.Chat.Roll.WeaponRangeTypes.broadsword",
    bayonet: "TWODSIX.Chat.Roll.WeaponRangeTypes.bayonet",
    spear: "TWODSIX.Chat.Roll.WeaponRangeTypes.spear",
    halberd: "TWODSIX.Chat.Roll.WeaponRangeTypes.halberd",
    pike: "TWODSIX.Chat.Roll.WeaponRangeTypes.pike",
    cudgel: "TWODSIX.Chat.Roll.WeaponRangeTypes.cudgel",
    bodyPistol: "TWODSIX.Chat.Roll.WeaponRangeTypes.bodyPistol",
    autoPistol: "TWODSIX.Chat.Roll.WeaponRangeTypes.autoPistol",
    revolver: "TWODSIX.Chat.Roll.WeaponRangeTypes.revolver",
    carbine: "TWODSIX.Chat.Roll.WeaponRangeTypes.carbine",
    rifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.rifle",
    autoRifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.autoRifle",
    shotgun: "TWODSIX.Chat.Roll.WeaponRangeTypes.shotgun",
    submachinegun: "TWODSIX.Chat.Roll.WeaponRangeTypes.submachinegun",
    laserCarbine: "TWODSIX.Chat.Roll.WeaponRangeTypes.laserCarbine",
    laserRifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.laserRifle",
    none: "TWODSIX.Chat.Roll.WeaponRangeTypes.none"
  },
  short: {
    hands: "TWODSIX.Chat.Roll.WeaponRangeTypes.hands",
    claws: "TWODSIX.Chat.Roll.WeaponRangeTypes.claws",
    teeth: "TWODSIX.Chat.Roll.WeaponRangeTypes.teeth",
    horns: "TWODSIX.Chat.Roll.WeaponRangeTypes.horns",
    hooves: "TWODSIX.Chat.Roll.WeaponRangeTypes.hooves",
    stinger: "TWODSIX.Chat.Roll.WeaponRangeTypes.stinger",
    thrasher: "TWODSIX.Chat.Roll.WeaponRangeTypes.thras",
    club: "TWODSIX.Chat.Roll.WeaponRangeTypes.club",
    dagger: "TWODSIX.Chat.Roll.WeaponRangeTypes.dagger",
    blade: "TWODSIX.Chat.Roll.WeaponRangeTypes.blade",
    foil: "TWODSIX.Chat.Roll.WeaponRangeTypes.foil",
    cutlass: "TWODSIX.Chat.Roll.WeaponRangeTypes.cutl",
    sword: "TWODSIX.Chat.Roll.WeaponRangeTypes.sword",
    broadsword: "TWODSIX.Chat.Roll.WeaponRangeTypes.brdswd",
    bayonet: "TWODSIX.Chat.Roll.WeaponRangeTypes.bynt",
    spear: "TWODSIX.Chat.Roll.WeaponRangeTypes.spear",
    halberd: "TWODSIX.Chat.Roll.WeaponRangeTypes.halb",
    pike: "TWODSIX.Chat.Roll.WeaponRangeTypes.pike",
    cudgel: "TWODSIX.Chat.Roll.WeaponRangeTypes.cudgel",
    bodyPistol: "TWODSIX.Chat.Roll.WeaponRangeTypes.bPistl",
    autoPistol: "TWODSIX.Chat.Roll.WeaponRangeTypes.aPistl",
    revolver: "TWODSIX.Chat.Roll.WeaponRangeTypes.revolver",
    carbine: "TWODSIX.Chat.Roll.WeaponRangeTypes.carbine",
    rifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.rifle",
    autoRifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.AR",
    shotgun: "TWODSIX.Chat.Roll.WeaponRangeTypes.shotgun",
    submachinegun: "TWODSIX.Chat.Roll.WeaponRangeTypes.subm",
    laserCarbine: "TWODSIX.Chat.Roll.WeaponRangeTypes.LC",
    laserRifle: "TWODSIX.Chat.Roll.WeaponRangeTypes.LR",
    none: "TWODSIX.Chat.Roll.WeaponRangeTypes.none"
  }
};

export const CT_ARMOR_TYPES = {
  nothing: "TWODSIX.Chat.Roll.ArmorTypes.nothing",
  jack: "TWODSIX.Chat.Roll.ArmorTypes.jack",
  mesh: "TWODSIX.Chat.Roll.ArmorTypes.mesh",
  cloth: "TWODSIX.Chat.Roll.ArmorTypes.cloth",
  reflec: "TWODSIX.Chat.Roll.ArmorTypes.reflec",
  ablat: "TWODSIX.Chat.Roll.ArmorTypes.ablat",
  combat: "TWODSIX.Chat.Roll.ArmorTypes.combat"
};

export const TARGET_DM = {};

export type TWODSIX = {
  CHARACTERISTICS: typeof CHARACTERISTICS,
  CONSUMABLES: typeof CONSUMABLES,
  DIFFICULTY_VARIANTS: typeof DIFFICULTY_VARIANTS,
  AUTOFIRE_VARIANTS: typeof AUTOFIRE_VARIANTS,
  ROLLTYPES: typeof ROLLTYPES,
  DIFFICULTIES: typeof DIFFICULTIES,
  RULESETS: typeof RULESETS,
  SHIP_ACTION_TYPE: typeof SHIP_ACTION_TYPE,
  MovementUnits: typeof MovementUnits,
  MovementType: typeof MovementTypes,
  PricingOptions: typeof PricingOptions,
  PowerOptions: typeof PowerOptions,
  HullPricingOptions: typeof HullPricingOptions,
  ComponentStates: typeof ComponentStates,
  ComponentTypes: typeof ComponentTypes,
  CharacteristicDisplayTypes: typeof CharacteristicDisplayTypes,
  TimeUnts: typeof TimeUnits,
  VehicleProtection: typeof VehicleProtection,
  AnimalNiche: typeof AnimalNiche,
  HerbivoreType: typeof HerbivoreType,
  OmnivoreType: typeof OmnivoreType,
  CarnivoreType: typeof CarnivoreType,
  ScavengerType: typeof ScavengerType,
  AllAnimalTypes: typeof AllAnimalTypes,
  AnimalLocations: typeof AnimalLocations,
  areaTargetTypes: typeof areaTargetTypes,
  SuccessTypes: typeof SuccessTypes,
  EQUIPPED_STATES: typeof EQUIPPED_STATES,
  EQUIPPED_TOGGLE_OPTIONS: typeof EQUIPPED_TOGGLE_OPTIONS,
  RANGE_MODIFIERS_TYPES: typeof RANGE_MODIFIERS_TYPES,
  CE_WEAPON_RANGE_TYPES: typeof CE_WEAPON_RANGE_TYPES,
  CT_WEAPON_RANGE_TYPES: typeof CT_WEAPON_RANGE_TYPES,
  CT_ARMOR_TYPES: typeof  CT_ARMOR_TYPES,
  TARGET_DM: object
};

export const TWODSIX = {
  CHARACTERISTICS: CHARACTERISTICS,
  CONSUMABLES: CONSUMABLES,
  DIFFICULTY_VARIANTS: DIFFICULTY_VARIANTS,
  AUTOFIRE_VARIANTS: AUTOFIRE_VARIANTS,
  ROLLTYPES: ROLLTYPES,
  DIFFICULTIES: DIFFICULTIES,
  RULESETS: RULESETS,
  SHIP_ACTION_TYPE: SHIP_ACTION_TYPE,
  MovementUnits: MovementUnits,
  MovementType: MovementTypes,
  PricingOptions: PricingOptions,
  PowerOptions: PowerOptions,
  HullPricingOptions: HullPricingOptions,
  ComponentStates: ComponentStates,
  ComponentTypes: ComponentTypes,
  CharacteristicDisplayTypes: CharacteristicDisplayTypes,
  TimeUnits: TimeUnits,
  VehicleProtection: VehicleProtection,
  AnimalNiche: AnimalNiche,
  HerbivoreType: HerbivoreType,
  OmnivoreType: OmnivoreType,
  CarnivoreType: CarnivoreType,
  ScavengerType: ScavengerType,
  AllAnimalTypes: AllAnimalTypes,
  AnimalLocations: AnimalLocations,
  areaTargetTypes: areaTargetTypes,
  SuccessTypes: SuccessTypes,
  EQUIPPED_STATES: EQUIPPED_STATES,
  EQUIPPED_TOGGLE_OPTIONS: EQUIPPED_TOGGLE_OPTIONS,
  RANGE_MODIFIERS_TYPES: RANGE_MODIFIERS_TYPES,
  CE_WEAPON_RANGE_TYPES: CE_WEAPON_RANGE_TYPES,
  CT_WEAPON_RANGE_TYPES: CT_WEAPON_RANGE_TYPES,
  CT_ARMOR_TYPES: CT_ARMOR_TYPES,
  TARGET_DM: TARGET_DM
};
