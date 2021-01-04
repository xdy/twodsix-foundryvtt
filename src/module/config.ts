// Namespace TWODSIX Configuration Values

const CHARACTERISTICS = Object.freeze({
  "strength": "STR",
  "dexterity": "DEX",
  "endurance": "END",
  "intelligence": "INT",
  "education": "EDU",
  "socialStanding": "SOC",
  "psionicStrength": "PSI"
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
      ShowRecoil: true
    }
  },
  CEL: {
    key: "CEL",
    name: "Cepheus Light",
    settings: {
      initiativeFormula: "2d6",
      difficultyListUsed: "CEL",
      difficultiesAsTargetNumber: true,
      autofireRulesUsed: "CEL",
      modifierForZeroCharacteristic: -2,
      termForAdvantage: "advantage",
      termForDisadvantage: "disadvantage",
      absoluteBonusValueForEachTimeIncrement: 1,
      criticalNaturalAffectsEffect: true,
      absoluteCriticalEffectValue: 99
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
      absoluteCriticalEffectValue: 99
    }
  },
  OTHER: {
    key: "OTHER",
    name: "Other",
    settings: {}
  }
});

const ROLLTYPES = Object.freeze({
  Advantage: {key: 'Advantage', formula: "3d6kh2"},
  Normal: {key: 'Normal', formula: "2d6"},
  Disadvantage: {key: 'Disadvantage', formula: "3d6kl2"}
});

const DIFFICULTIES = Object.freeze({
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

const CRIT = Object.freeze({"SUCCESS": 1, "FAIL": 2});

export const TWODSIX = {
  CHARACTERISTICS: CHARACTERISTICS,
  VARIANTS: VARIANTS,
  ROLLTYPES: ROLLTYPES,
  DIFFICULTIES: DIFFICULTIES,
  RULESETS: RULESETS,
  CRIT: CRIT
};
