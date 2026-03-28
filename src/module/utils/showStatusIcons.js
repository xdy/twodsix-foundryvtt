import { TWODSIX } from '../config';

/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */
import { getDamageCharacteristics } from './actorDamage';

// =====================
// 1. Main API (Exports)
// =====================

/**
 * Batch apply all relevant status effects (encumbered, wounded, etc.) to the actor in a single update cycle.
 * Uses modular helpers to collect changes, then applies them in a single batch.
 * @param {TwodsixActor} actor The actor to update
 * @param {object} options Flags for which effects to check (default: all)
 * @param {boolean} options.encumbrance Whether to check encumbrance
 * @param {boolean} options.wounded Whether to check wounded
 */
export async function applyAllStatusEffects(
  actor,
  {encumbrance = true, wounded = true} = {}
) {
  if (actor._applyingStatusEffects) {
    return;
  }
  actor._applyingStatusEffects = true;
  try {
    let create = [], update = [], del = [];
    if (encumbrance) {
      const changes = await getEncumberedEffectChanges(actor);
      create = create.concat(changes.create);
      update = update.concat(changes.update);
      del = del.concat(changes.delete);
    }
    if (wounded) {
      const changes = await getWoundedEffectChanges(actor);
      create = create.concat(changes.create);
      update = update.concat(changes.update);
      del = del.concat(changes.delete);
    }
    const promises = [];
    const suppressRender = {render: false};
    if (create.length) {
      promises.push(actor.createEmbeddedDocuments("ActiveEffect", create, suppressRender));
    }
    if (update.length) {
      promises.push(actor.updateEmbeddedDocuments("ActiveEffect", update, suppressRender));
    }
    if (del.length) {
      promises.push(actor.deleteEmbeddedDocuments("ActiveEffect", del, suppressRender));
    }
    await Promise.all(promises);
    if (promises.length > 0) {
      // Manually refresh the actor sheet after all changes
      if (actor.sheet?.rendered) {
        actor.sheet.render(true);
      }
      // Refresh all tokens for this actor to update overlays/effects
      if (actor.getActiveTokens) {
        for (const token of actor.getActiveTokens(true)) {
          token.refresh();
        }
      }
    }
  } catch (error) {
    console.error("Error applying status effects:", error);
  } finally {
    actor._applyingStatusEffects = false;
  }
}

/**
 * Inspect an update payload (typically an ActiveEffect update) to determine
 * whether any of the changes target one of this actor type's damage
 * characteristics. Used to short-circuit or trigger damage-related logic when
 * ActiveEffects modify characteristic fields.
 *
 * @param {object} update - The update payload containing `effects` (ActiveEffect data)
 * @param {string} actorType - The actor type (e.g. "traveller", "animal") used
 *   to resolve which characteristics count as damage targets via
 *   `getDamageCharacteristics(actorType)`.
 * @returns {boolean} True if any change key includes a damage characteristic.
 */
export function checkForDamageStat(update, actorType) {
  const damageCharacteristics = getDamageCharacteristics(actorType);
  return !!(update.effects?.some((effect) =>
    (effect.system?.changes ?? []).some((change) =>
      damageCharacteristics.some((char) => (change?.key ?? '').includes(`characteristics.${char}.`))
    )
  ));
}

// =====================
// 2. Batching Logic
// =====================

/**
 * Determine whether encumbered effect applies to actor and return changes to apply.
 * Handles deduplication, deletion, and creation/update of encumbered ActiveEffects by retuning a change object for batching.
 * @param {TwodsixActor} actor - The actor to check.
 * @returns {Promise<{create: any[], update: any[], delete: string[]}>} Object with arrays of effects to create, update, or delete.
 */
async function getEncumberedEffectChanges(actor) {
  let state = false;
  let aeToKeep = undefined;
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const encumbranceFraction = parseFloat(game.settings.get('twodsix', 'encumbranceFraction'));
  const maxEncumbrance = actor.system.encumbrance.max;
  if (actor.system.hits.value > 0) {
    if (maxEncumbrance === 0 && actor.system.encumbrance.value > 0) {
      state = true;
    } else if (maxEncumbrance > 0) {
      const ratio = actor.system.encumbrance.value / maxEncumbrance;
      state = (ratio > encumbranceFraction);
    }
  }

  //Dedupe or delete encumbrance effects if necessary
  const currentEncumberedEffects = actor.effects.filter(eff => eff.statuses.has('encumbered'));
  let toDelete = [];
  if (currentEncumberedEffects.length > 0) {
    if (state === true) {
      aeToKeep = currentEncumberedEffects.pop();
    }
    if (currentEncumberedEffects.length > 0) {
      toDelete = currentEncumberedEffects.map(i => i.id);
    }
  }

  //Add or modify exsiting AE if actor is encumbered
  if (state === true) {
    const modifier = getEncumbranceModifier(actor);
    const changeData = buildEncumbranceChangeData(ruleset, modifier);
    if (!aeToKeep) {
      return {create: [getEncumberedEffect(changeData)], update: [], delete: toDelete};
    } else if (!foundry.utils.equals(changeData, aeToKeep.system.changes)) {
      return {create: [], update: [{_id: aeToKeep.id, 'system.changes': changeData}], delete: toDelete};
    }
  }
  if (toDelete.length > 0) {
    return {create: [], update: [], delete: toDelete};
  }
  return {create: [], update: [], delete: []};
}

/**
 * Determine whether wounded, dead, or unconscious effects apply to actor and return changes to apply.
 * Determines creation, update, and deletion changes of related ActiveEffects for batching.
 * @param {TwodsixActor} actor - The actor to check.
 * @returns {Promise<{create: any[], update: any[], delete: string[]}>} Object with arrays of effects to create, update, or delete.
 */
async function getWoundedEffectChanges(actor) {
  const tintToApply = getIconTint(actor);
  const oldWoundState = getEffectByStatus(actor, "wounded");
  const deadEffect = getEffectByStatus(actor, "dead");
  const unconsciousEffect = getEffectByStatus(actor, "unconscious");
  const toDelete = [];
  const create = [], update = [], unconsciousCreate = [];

  // --- Dead status ---
  if (tintToApply === TWODSIX.DAMAGECOLORS.deadTint) {
    if (!deadEffect) {
      create.push(getDeadEffect());
    }
    if (oldWoundState) {
      toDelete.push(oldWoundState.id);
    }
    if (unconsciousEffect) {
      toDelete.push(unconsciousEffect.id);
    }
    // Only keep dead effect
    return {create, update: [], delete: toDelete};
  } else if (deadEffect) {
    // Remove dead effect if not dead
    toDelete.push(deadEffect.id);
  }

  // --- Wounded status ---
  if (!tintToApply) {
    if (oldWoundState) {
      toDelete.push(oldWoundState.id);
    }
    return {create: [], update: [], delete: toDelete};
  }

  let woundModifier = 0;
  switch (tintToApply) {
    case TWODSIX.DAMAGECOLORS.minorWoundTint:
      woundModifier = game.settings.get('twodsix', 'minorWoundsRollModifier');
      break;
    case TWODSIX.DAMAGECOLORS.seriousWoundTint:
      woundModifier = game.settings.get('twodsix', 'seriousWoundsRollModifier');
      break;
  }
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const changeData = buildWoundedChangeData(ruleset, tintToApply, woundModifier);

  // --- Unconsciousness status ---
  if (!unconsciousEffect && !deadEffect) {
    if (await isUnconscious(actor, ruleset, tintToApply, oldWoundState)) {
      unconsciousCreate.push(getUnconsciousEffect());
    }
  }

  if (!oldWoundState) {
    create.push(getWoundedEffect(tintToApply, changeData));
    return {create: create.concat(unconsciousCreate), update: [], delete: toDelete};
  } else if (!tintEquals(oldWoundState.tint, tintToApply)) {
    update.push({_id: oldWoundState.id, tint: tintToApply, changes: [changeData]});
    return {create: unconsciousCreate, update, delete: toDelete};
  }
  return {create: [], update: [], delete: toDelete};
}

// ================================
// 3. Effect Construction Helpers
// ================================

/**
 * @returns {object}
 */
function getDeadEffect() {
  return {
    name: game.i18n.localize(TWODSIX.effectType.dead),
    img: "icons/svg/skull.svg",
    statuses: ["dead"],
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
    system: {changes: []}
  };
}

/**
 * @param {string} tintToApply
 * @param {object} changeData
 * @returns {object}
 */
function getWoundedEffect(tintToApply, changeData) {
  return {
    name: game.i18n.localize(TWODSIX.effectType.wounded),
    img: "icons/svg/blood.svg",
    tint: tintToApply,
    system: {changes: [changeData]},
    statuses: ["wounded"],
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS
  };
}

/**
 * @returns {object}
 */
function getUnconsciousEffect() {
  return {
    name: game.i18n.localize(TWODSIX.effectType.unconscious),
    img: "icons/svg/unconscious.svg",
    statuses: ["unconscious"],
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
    system: {changes: []}
  };
}

/**
 * @param {object[]} changeData
 * @returns {object}
 */
function getEncumberedEffect(changeData) {
  return {
    name: game.i18n.localize(TWODSIX.effectType.encumbered),
    img: "systems/twodsix/assets/icons/weight.svg",
    system: {changes: changeData},
    statuses: ["encumbered"],
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS
  };
}

// =====================
// 5. Utilities
// =====================

/**
 * Roll to determine if the actor becomes unconscious due to wounds.
 * Uses END characteristic and a standard 8+ difficulty, with flavor text for the roll.
 * @param {TwodsixActor} selectedActor - The actor to roll for unconsciousness.
 * @returns {Promise<boolean>} True if the roll fails (actor is unconscious), false otherwise.
 */
async function rollForUnconsciousness(selectedActor) {
  const setDifficulty = Object.values(TWODSIX.DIFFICULTIES[(game.settings.get('twodsix', 'difficultyListUsed'))]).find(e => e.target === 8); //always 8+
  const returnRoll = await selectedActor.characteristicRoll({
    rollModifiers: {characteristic: 'END'},
    difficulty: setDifficulty,
    extraFlavor: game.i18n.localize("TWODSIX.Rolls.MakesUncRoll")
  }, false);
  return !!(returnRoll && returnRoll.effect < 0);
}

/**
 * @param {object} selectedTraveller
 * @returns {object[]}
 */
function getPrimaryCharacteristics(selectedTraveller) {
  return [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
}

// Helper to get the first effect with a given status
/**
 * @param {TwodsixActor} actor
 * @param {string} statusName
 * @returns {ActiveEffect | undefined}
 */
function getEffectByStatus(actor, statusName) {
  return actor.effects.find(eff => eff.statuses.has(statusName));
}

// Helper to robustly compare tints (string or Color object)
// Necessary because core FVTT moved from string (hex) values for tint to a Color object where tint.css is now hex value
/**
 * @param {string | object} tint
 * @param {string} color
 * @returns {boolean}
 */
function tintEquals(tint, color) {
  return (typeof tint === 'string' ? tint : tint?.css) === color;
}

// =====================================
// 6. Ruleset/Domain-Specific Logic
// =====================================

/**
 * Determine the wounded tint that applies to actor.  Depends on ruleset.
 * @param {TwodsixActor} selectedActor  The actor to check
 * @returns {string} The wounded tint color (as a hex code string).  Color indicates the severity of wounds. TWODSIX.DAMAGECOLORS.minorWoundTint and TWODSIX.DAMAGECOLORS.seriousWoundTint
 */
function getIconTint(selectedActor) {
  const selectedTraveller = selectedActor.system;
  if ((selectedActor.type === 'animal' && game.settings.get('twodsix', 'animalsUseHits')) || (selectedActor.type === 'robot' && game.settings.get('twodsix', 'robotsUseHits'))) {
    return (getHitsTint(selectedTraveller));
  } else {
    switch (game.settings.get('twodsix', 'ruleset')) {
      case 'CD':
      case 'CLU':
      case 'CDEE':
        return (getCDWoundTint(selectedTraveller));
      case 'CEL':
      case 'CEFTL':
      case 'SOC':
      case 'CT':
        return (getCELWoundTint(selectedTraveller));
      case 'CE':
      case 'AC':
      case 'OTHER':
      case "MGT2E":
      case "RIDER":
        return (getCEWoundTint(selectedTraveller));
      case 'CEQ':
      case 'CEATOM':
      case 'BARBARIC':
        return (getCEAWoundTint(selectedTraveller));
      case 'CU':
        return (getCUWoundTint(selectedTraveller));
      default:
        return ('');
    }
  }
}

/**
 * @param {object} selectedTraveller
 * @returns {string}
 */
function getHitsTint(selectedTraveller) {
  let returnVal = '';
  if (selectedTraveller.characteristics.lifeblood.current <= 0) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics.lifeblood.current < (selectedTraveller.characteristics.lifeblood.value / 3)) {
    returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics.lifeblood.current < (2 * selectedTraveller.characteristics.lifeblood.value / 3)) {
    returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

/**
 * @param {object} selectedTraveller
 * @returns {string}
 */
function getCDWoundTint(selectedTraveller) {
  let returnVal = '';
  if (selectedTraveller.characteristics.lifeblood.current <= 0 && selectedTraveller.characteristics.stamina.current <= 0) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics.lifeblood.current < (selectedTraveller.characteristics.lifeblood.value / 2)) {
    returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics.lifeblood.damage > 0) {
    returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

/**
 * @param {object} selectedTraveller
 * @returns {string}
 */
function getCELWoundTint(selectedTraveller) {
  let returnVal = '';
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  const maxNonZero = testArray.filter(chr => chr.value !== 0).length;
  const currentZero = testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length;
  if (currentZero === maxNonZero) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (currentZero > 0) {
    if (currentZero > 1) {
      returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
    } else {
      returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
    }
  }
  return returnVal;
}

/**
 * @param {object} selectedTraveller
 * @returns {string}
 */
function getCEWoundTint(selectedTraveller) {
  let returnVal = '';
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  const maxNonZero = testArray.filter(chr => chr.value !== 0).length;
  const currentZero = testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length;
  const numDamaged = testArray.filter(chr => chr.damage > 0 && chr.value !== 0).length;
  if (currentZero === maxNonZero) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (numDamaged > 0) {
    if (maxNonZero > 1) {
      if (numDamaged === maxNonZero) {
        returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
      } else {
        returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
      }
    } else {
      if (testArray.filter(chr => (chr.damage >= chr.value / 2) && chr.value !== 0).length) {
        returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
      } else {
        returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
      }
    }
  }
  return returnVal;
}

/**
 * @param {object} selectedTraveller
 * @returns {string}
 */
function getCUWoundTint(selectedTraveller) {
  let returnVal = '';
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  const currentZero = testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length;
  if (currentZero === 3) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (currentZero === 2) {
    returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
  } else if (currentZero === 1) {
    returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

/**
 * @param {object} selectedTraveller
 * @returns {boolean}
 */
function isUnconsciousCE(selectedTraveller) {
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  return (testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length === 2);
}

/**
 * Determine if the unconscious effect should be applied to the actor based on ruleset and wound state.
 * Handles ruleset-specific logic and transition checks for serious wounds and unconsciousness rolls.
 * @param {TwodsixActor} actor - The actor to check.
 * @param {string} ruleset - The current ruleset identifier.
 * @param {string} tintToApply - The tint color indicating wound severity.
 * @param {any} oldWoundState - The previous wounded effect state, if any.
 * @returns {Promise<boolean>} True if the unconscious effect should be applied, false otherwise.
 */
async function isUnconscious(actor, ruleset, tintToApply, oldWoundState) {
  const oldTint = oldWoundState && (typeof oldWoundState.tint === 'string' ? oldWoundState.tint : oldWoundState.tint?.css);
  if (["CE", "AC", "CU", "RIDER", "OTHER"].includes(ruleset)) {
    return isUnconsciousCE(actor.system);
  } else if (["CT"].includes(ruleset)) {
    return !oldWoundState && [TWODSIX.DAMAGECOLORS.minorWoundTint, TWODSIX.DAMAGECOLORS.seriousWoundTint].includes(tintToApply);
  } else if (
    oldWoundState &&
    !tintEquals(oldTint, TWODSIX.DAMAGECOLORS.seriousWoundTint) &&
    tintToApply === TWODSIX.DAMAGECOLORS.seriousWoundTint
  ) {
    if (["CEQ", "CEATOM", "BARBARIC"].includes(ruleset)) {
      return true;
    } else {
      const failedRoll = await rollForUnconsciousness(actor);
      return failedRoll;
    }
  }
  return false;
}

/**
 * @param {object} selectedTraveller
 * @returns {string}
 */
function getCEAWoundTint(selectedTraveller) {
  let returnVal = '';
  const lfbCharacteristic = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'strength' : 'lifeblood';
  const endCharacteristic = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'endurance' : 'stamina';
  const currentHits = selectedTraveller.characteristics[lfbCharacteristic].current + selectedTraveller.characteristics[endCharacteristic].current;
  //const totalHits = selectedTraveller.characteristics[lfbCharacteristic].value + selectedTraveller.characteristics[endCharacteristic].value;
  if (currentHits <= 0) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics[lfbCharacteristic].current < (selectedTraveller.characteristics[lfbCharacteristic].value / 2)) {
    returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics[endCharacteristic].current <= 0) {
    returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

/**
 * @param {string} ruleset
 * @param {string} tint
 * @param {number} woundModifier
 * @returns {object}
 */
function buildWoundedChangeData(ruleset, tint, woundModifier) {
  if (["AC", "CE", "RIDER"].includes(ruleset) && tintEquals(tint, TWODSIX.DAMAGECOLORS.seriousWoundTint)) {
    return {key: "system.movement.walk", type: "override", phase: "initial", value: 1.5};
  } else {
    return {key: "system.conditions.woundedEffect", type: "add", phase: "derived", value: woundModifier.toString()};
  }
}

/**
 * @param {string} ruleset
 * @param {string} modifier
 * @returns {object[]}
 */
function buildEncumbranceChangeData(ruleset, modifier) {
  if (ruleset === 'CT') {
    return [
      {
        key: "system.characteristics.strength.value",
        type: "add",
        phase: "initial",
        value: modifier
      },
      {
        key: "system.characteristics.dexterity.value",
        type: "add",
        phase: "initial",
        value: modifier
      },
      {
        key: "system.characteristics.endurance.value",
        type: "add",
        phase: "initial",
        value: modifier
      }
    ];
  }

  const data = [
    {
      key: "system.conditions.encumberedEffect",
      type: "add",
      phase: "derived",
      value: modifier
    }
  ];

  if (ruleset === 'CU') {
    data.push({
      key: "system.movement.walk",
      type: "multiply",
      phase: "initial",
      value: 0.75
    });
  }

  return data;
}

/**
 * Determine the encumbrance modifier based on the  ratio of encumbrance to the maximum encumbrance.
 * @param {TwodsixActor} selectedTraveller  actor to check for encumbered condition
 * @return {number} encumbrance roll modifier value that gets applied to the encumbered AE
 * @function
 */
function getEncumbranceModifier(selectedTraveller) {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  const encumbranceFraction = parseFloat(game.settings.get('twodsix', 'encumbranceFraction'));
  const encumbranceModifier = game.settings.get('twodsix', 'encumbranceModifier');
  const maxEncumbrance = selectedTraveller.system.encumbrance.max;
  let ratio = 0;
  if (maxEncumbrance === 0 && selectedTraveller.system.encumbrance.value > 0) {
    ratio = 1;
  } else if (maxEncumbrance > 0) {
    ratio = selectedTraveller.system.encumbrance.value / maxEncumbrance;
  }

  let modifier = 0;
  if (ratio === 0) {
    modifier = 0;
  } else if (["CE", "RIDER"].includes(ruleset)) {
    if (ratio <= encumbranceFraction) {
      modifier = 0;
    } else if (ratio <= encumbranceFraction * 2) {
      modifier = encumbranceModifier;
    } else {
      if (ratio <= encumbranceFraction * 3) {
        modifier = encumbranceModifier * 2;
      } else {
        modifier = encumbranceModifier * 20; //Cannot take any actions other than push
      }
    }
  } else if (["CU", "CT"].includes(ruleset)) {
    if (ratio <= 1 / 3) {
      modifier = 0;
    } else if (ratio <= 2 / 3) {
      modifier = encumbranceModifier;
    } else {
      modifier = encumbranceModifier * 2;
    }
  } else {
    modifier = encumbranceModifier;
  }
  return modifier.toString();
}
