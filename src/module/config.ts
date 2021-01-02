// Namespace TWODSIX Configuration Values

export const TWODSIX:any = {};

TWODSIX.CHARACTERISTICS = {
  "strength": "STR",
  "dexterity": "DEX",
  "endurance": "END",
  "intelligence": "INT",
  "education": "EDU",
  "socialStanding": "SOC",
  "psionicStrength": "PSI"
};

/**
 * The sets of rules variants one can use.
 * Note that only variants that actually have different rules implementations are listed here.
 * @type {Object}
 */
TWODSIX.VARIANTS = {
  "CE": "CE",
  "CEL": "CEL",
};

TWODSIX.RULESETS = {
  "CE": {
    "name": "Cepheus Engine",
    "setttings": {
      "initiativeFormula": "2d6 + @characteristics.dexterity.mod",
      "difficultyListUsed": "CE",
      "difficultiesAsTargetNumber": false,
      "autofireRulesUsed": "CE",
      "modifierForZeroCharacteristic": -2,
      "termForAdvantage": "advantage",
      "termForDisadvantage": "disadvantage",
      "absoluteBonusValueForEachTimeIncrement": 1
    }
  },
  "CEL": {
    "name": "Cepheus Light",
    "setttings": {
      "initiativeFormula": "2d6",
      "difficultyListUsed": "CEL",
      "difficultiesAsTargetNumber": true,
      "autofireRulesUsed": "CEL",
      "modifierForZeroCharacteristic": -2,
      "termForAdvantage": "advantage",
      "termForDisadvantage": "disadvantage",
      "absoluteBonusValueForEachTimeIncrement": 1
    }
  },
  "CEFTL": {
    "name": "Cepheus Faster Than Light",
    "setttings": {
      "initiativeFormula": "2d6",
      "difficultyListUsed": "CEL",
      "difficultiesAsTargetNumber": true,
      "autofireRulesUsed": "CE",
      "modifierForZeroCharacteristic": -2,
      "termForAdvantage": "advantage",
      "termForDisadvantage": "disadvantage",
      "absoluteBonusValueForEachTimeIncrement": 1
    }
  },
  "OTHER": {
    "name": "Other",
    "setttings": {}
  }
};

TWODSIX.ROLLTYPES = {
  Advantage: "3d6kh2",
  Normal: "2d6",
  Disadvantage: "3d6kl2"
};

TWODSIX.DIFFICULTIES = {
  "CE": {
    Simple: {mod: 6, target: 2},
    Easy: {mod: 4, target: 4},
    Routine: {mod: 2, target: 6},
    Average: {mod: 0, target: 8},
    Difficult: {mod: -2, target: 10},
    VeryDifficult: {mod: -4, target: 12},
    Formidable: {mod: -6, target: 14},
    Impossible: {mod: -8, target: 16},
  },
  "CEL": {
    Routine: {mod: 2, target: 4},
    Average: {mod: 0, target: 6},
    Difficult: {mod: -2, target: 8},
    VeryDifficult: {mod: -4, target: 10},
    Formidable: {mod: -6, target: 12},
  }
};
