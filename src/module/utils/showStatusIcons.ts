// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Traveller } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { TWODSIX } from "../config";
import { getDamageCharacteristics } from "./actorDamage";
import { TwodsixActiveEffect } from "../entities/TwodsixActiveEffect";

// Track which actors have encumbrance updates in progress to prevent concurrent modifications
const encumbranceUpdateInProgress = new Set<string>();

// Track which actors have wounded state updates in progress to prevent concurrent modifications
const woundedStateUpdateInProgress = new Set<string>();

// Track per-status updates to avoid duplicate unconscious/etc. during rapid changes
const conditionUpdateInProgress = new Set<string>();

/**
 * Determine whether wounded effect applies to actor.  Update encumbered AE & tint, if necessary.
 * @param {TwodsixActor} selectedActor  The actor to check
 * @public
 */
export async function applyWoundedEffect(selectedActor: TwodsixActor): Promise<void> {
  const tintToApply = getIconTint(selectedActor);
  const oldWoundState = selectedActor.effects.find(eff => eff.statuses.has("wounded"));
  const isCurrentlyDead = selectedActor.effects.find(eff => eff.statuses.has("dead"));

  if (!tintToApply) {
    if (isCurrentlyDead) {
      await setConditionState('dead', selectedActor, false);
    }
    if (oldWoundState) {
      await setWoundedState(selectedActor, false, tintToApply);
    }
  } else {
    if (tintToApply === TWODSIX.DAMAGECOLORS.deadTint) {
      if (!isCurrentlyDead) {
        await setConditionState('dead', selectedActor, true);
      }
      if (oldWoundState) {
        await setWoundedState(selectedActor, false, tintToApply);
      }
      await setConditionState('unconscious', selectedActor, false);
    } else {
      if (isCurrentlyDead) {
        await setConditionState('dead', selectedActor, false);
      }
      if (selectedActor.type !== 'animal'  && selectedActor.type !== 'robot' && !isCurrentlyDead /*&& oldWoundState?.tint.css !== TWODSIX.DAMAGECOLORS.seriousWoundTint*/) {
        await checkUnconsciousness(selectedActor, oldWoundState, tintToApply);
      }
      if (tintToApply !== oldWoundState?.tint.css) {
        await setWoundedState(selectedActor, true, tintToApply);
      }
    }
  }
}

/**
 * Determine whether encumbered effect applies to actor.  Update encumbered AE, if necessary.
 * @param {TwodsixActor} selectedActor  The actor to check
 * @public
 */
export async function applyEncumberedEffect(selectedActor: TwodsixActor): Promise<void> {
  await withGuard(encumbranceUpdateInProgress, selectedActor.uuid, async () => {
    let state = false;
    let ratio = 0;
    let aeToKeep: TwodsixActiveEffect | undefined = undefined;
    const ruleset = game.settings.get('twodsix', 'ruleset');
    const encumbranceFraction = parseFloat(game.settings.get('twodsix', 'encumbranceFraction'));
    const encumbranceModifier = game.settings.get('twodsix', 'encumbranceModifier');
    const maxEncumbrance = selectedActor.system.encumbrance.max; //selectedActor.getMaxEncumbrance()

    //Determined whether encumbered if not dead
    if (selectedActor.system.hits.value > 0) {
      if (maxEncumbrance === 0 && selectedActor.system.encumbrance.value > 0) {
        state = true;
        ratio = 1;
      } else if (maxEncumbrance > 0) {
        ratio = /*selectedActor.getActorEncumbrance()*/ selectedActor.system.encumbrance.value / maxEncumbrance;
        state = (ratio > encumbranceFraction); //remove await
      }
    }

    // Delete encumbered AE's if unneeded or more than one
    const currentEncumberedEffects = selectedActor.effects.filter(eff => eff.statuses.has('encumbered'));
    if (currentEncumberedEffects.length > 0) {
      if (state === true) {
        aeToKeep = currentEncumberedEffects.pop();
      }
      if (currentEncumberedEffects.length > 0) {
        const idList = currentEncumberedEffects.map(i => i.id);
        await selectedActor.deleteEmbeddedDocuments("ActiveEffect", idList, { dontSync: true });
      }
    }

    //Define AE if actor is encumbered
    if (state === true) {
      const modifier: string = getEncumbranceModifier(ratio, encumbranceFraction, encumbranceModifier, ruleset).toString();
      const changeData = buildEncumbranceChangeData(ruleset, modifier);

      if (!aeToKeep) {
        await selectedActor.createEmbeddedDocuments("ActiveEffect", [
          {
            name: game.i18n.localize(TWODSIX.effectType.encumbered),
            img: "systems/twodsix/assets/icons/weight.svg",
            changes: changeData,
            statuses: ["encumbered"]
          }
        ], { dontSync: true });
      } else if (changeData[0].value !== aeToKeep.changes[0].value) {
        await aeToKeep.update({ changes: changeData }, { dontSync: true });
      }
    }
  });
}

/**
 * Determine whether actor becomes unconscious based on ruleset. Depending on ruleset, may make endurance roll.
 * @param {TwodsixActor} selectedActor  The actor to check
 * @param {TwodsixActiveEffect | undefined} oldWoundState The current wounded AE for actor
 * @param {string} tintToApply The wounded state tint to be applied (the updated tint)
 */
async function checkUnconsciousness(selectedActor: TwodsixActor, oldWoundState: TwodsixActiveEffect | undefined, tintToApply: string): Promise<void> {
  const isAlreadyUnconscious = selectedActor.effects.some(eff => eff.statuses.has('unconscious'));
  const isAlreadyDead = selectedActor.effects.some(eff => eff.statuses.has('dead'));
  if (isAlreadyUnconscious || isAlreadyDead) {
    return;
  }

  const rulesSet = game.settings.get('twodsix', 'ruleset');

  if (['CE', 'AC', 'CU', 'OTHER', "MGT2E"].includes(rulesSet)) {
    await handleCEStyleUnconscious(selectedActor);
  } else if (rulesSet === 'CT') {
    await handleCTUnconscious(selectedActor, oldWoundState, tintToApply);
  } else if (oldWoundState?.tint.css !== TWODSIX.DAMAGECOLORS.seriousWoundTint && tintToApply === TWODSIX.DAMAGECOLORS.seriousWoundTint) {
    await handleSeriousWoundUnconscious(selectedActor, rulesSet);
  }
}

async function handleCEStyleUnconscious(selectedActor: TwodsixActor): Promise<void> {
  if (isUnconsciousCE(<Traveller>selectedActor.system)) {
    await setConditionState('unconscious', selectedActor, true);
  }
}

async function handleCTUnconscious(selectedActor: TwodsixActor, oldWoundState: TwodsixActiveEffect | undefined, tintToApply: string): Promise<void> {
  if (!oldWoundState && [TWODSIX.DAMAGECOLORS.minorWoundTint, TWODSIX.DAMAGECOLORS.seriousWoundTint].includes(tintToApply)) {
    await setConditionState('unconscious', selectedActor, true); // Automatic unconsciousness or out of combat
  }
}

async function handleSeriousWoundUnconscious(selectedActor: TwodsixActor, rulesSet: string): Promise<void> {
  if (['CEQ', 'CEATOM', 'BARBARIC'].includes(rulesSet)) {
    await setConditionState('unconscious', selectedActor, true); // Automatic unconsciousness or out of combat
    return;
  }

  const failedRoll = await rollSeriousWoundUnconscious(selectedActor);
  if (failedRoll) {
    await setConditionState('unconscious', selectedActor, true);
  }
}

async function rollSeriousWoundUnconscious(selectedActor: TwodsixActor): Promise<boolean> {
  const setDifficulty = Object.values(TWODSIX.DIFFICULTIES[(game.settings.get('twodsix', 'difficultyListUsed'))]).find(e => e.target === 8); //always 8+
  const returnRoll = await selectedActor.characteristicRoll({
    rollModifiers: {characteristic: 'END'},
    difficulty: setDifficulty,
    extraFlavor: game.i18n.localize("TWODSIX.Rolls.MakesUncRoll")
  }, false);
  return !!(returnRoll && returnRoll.effect < 0);
}

/**
 * Toggles an effect status/condition on an actor.
 * @param {string} effectStatus status/condition name to change
 * @param {TwodsixActor} targetActor  The actor to update
 * @param {boolean} state Whether the status is enabled
 */
async function setConditionState(effectStatus: string, targetActor: TwodsixActor, state: boolean): Promise<void> {
  const statusKey = `${targetActor.uuid}::${effectStatus}`;

  await withGuard(conditionUpdateInProgress, statusKey, async () => {
    const existingEffect = await dedupeStatusEffects(targetActor, effectStatus);
    const targetEffect = CONFIG.statusEffects.find(statusEffect => (statusEffect.id === effectStatus));
    if (!targetEffect) {
      return;
    }

    const needsChange = (existingEffect !== undefined) !== state;
    if (!needsChange) {
      return;
    }

    const toggleOptions = effectStatus === 'dead'
      ? {active: state, overlay: false}
      : {active: state};

    await targetActor.toggleStatusEffect(targetEffect.id, toggleOptions);
  });
}

/**
 * Determine whether wounded effect applies to actor.  Update wounded AE, if necessary.
 * @param {TwodsixActor} targetActor  The actor to check
 * @param {boolean} state whether wounded effect applies
 * @param {string} tint The wounded tint color (as a hex code string).  Color indicates the severity of wounds. TWODSIX.DAMAGECOLORS.minorWoundTint and TWODSIX.DAMAGECOLORS.seriousWoundTint
 */
async function setWoundedState(targetActor: TwodsixActor, state: boolean, tint: string): Promise<void> {
  await withGuard(woundedStateUpdateInProgress, targetActor.uuid, async () => {
    const existingWound = await dedupeStatusEffects(targetActor, "wounded");
    const currentEffectId = existingWound?.id ?? "";
    // Remove effect if state false
    if (!state) {
      if (currentEffectId) {
        await targetActor.deleteEmbeddedDocuments("ActiveEffect", [currentEffectId], { dontSync: true });
      }
      return;
    }

    //Set effect if state true
    let woundModifier = 0;
    switch (tint) {
      case TWODSIX.DAMAGECOLORS.minorWoundTint:
        woundModifier = game.settings.get('twodsix', 'minorWoundsRollModifier');
        break;
      case TWODSIX.DAMAGECOLORS.seriousWoundTint:
        woundModifier = game.settings.get('twodsix', 'seriousWoundsRollModifier');
        break;
    }
    let changeData = {}; //AC has a movement penalty not roll penalty
    if ( ['AC', 'CE'].includes(game.settings.get('twodsix', 'ruleset')) && tint === TWODSIX.DAMAGECOLORS.seriousWoundTint) {
      changeData = { key: "system.movement.walk", type: "override", phase: "initial", value: 1.5 };
    } else {
      changeData = { key: "system.conditions.woundedEffect", type: "add", phase: "derived", value: woundModifier.toString() };
    }
    //
    if (!currentEffectId) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [{
        name: game.i18n.localize(TWODSIX.effectType.wounded),
        img: "icons/svg/blood.svg",
        tint: tint,
        changes: [changeData],
        statuses: ['wounded']
      }], { dontSync: true });
    } else {
      const currentEfffect = targetActor.effects.get(currentEffectId);
      if (currentEfffect.tint !== tint) {
        await targetActor.updateEmbeddedDocuments('ActiveEffect', [{ _id: currentEffectId, tint: tint, changes: [changeData] }], { dontSync: true });
      }
    }
  });
}

/**
 * Remove duplicate ActiveEffects that share the same status on an actor.
 * Keeps the first matching ActiveEffect and removes any additional duplicates.
 * Returns the surviving ActiveEffect (or undefined if none were present).
 *
 * This helps ensure there is at most one AE with the given status and
 * prevents concurrently-created duplicates from lingering.
 *
 * @param {TwodsixActor} actor - The actor whose ActiveEffects will be scanned.
 * @param {string} statusId - The status identifier to deduplicate (e.g. 'wounded').
 * @returns {Promise<TwodsixActiveEffect|undefined>} The kept ActiveEffect or undefined.
 */
async function dedupeStatusEffects(actor: TwodsixActor, statusId: string): Promise<TwodsixActiveEffect | undefined> {
  const matches = actor.effects.filter(eff => eff.statuses.has(statusId));
  if (matches.length === 0) {
    return undefined;
  }
  const [keep, ...dupes] = matches;
  if (dupes.length > 0) {
    const ids = dupes.map(eff => eff.id).filter(Boolean);
    if (ids.length) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", ids, { dontSync: true });
    }
  }
  return keep;
}

/**
 * Execute an async function while preventing concurrent executions for the same key.
 * If the provided `guardSet` already contains `key`, the call is skipped and
 * `undefined` is returned. Otherwise `key` is added to `guardSet` for the
 * duration of `fn` and removed afterwards (even if `fn` throws).
 *
 * @template T
 * @param {Set<string>} guardSet - A Set tracking in-progress keys (per-concern guards).
 * @param {string} key - The unique key to guard (e.g. actor UUID or `${actorUUID}::status`).
 * @param {() => Promise<T>} fn - The async function to execute while guarded.
 * @returns {Promise<T|undefined>} The result of `fn`, or `undefined` if the call was skipped due to an existing guard.
 */
async function withGuard<T>(guardSet: Set<string>, key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (guardSet.has(key)) {
    return undefined;
  }

  try {
    guardSet.add(key);
    return await fn();
  } finally {
    guardSet.delete(key);
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
export function checkForDamageStat (update: any, actorType: string): boolean {
  if (update.effects?.length > 0) {
    const damageCharacteristics = getDamageCharacteristics(actorType);
    for (const effect of update.effects) {
      for (const change of effect.changes) {
        for (const char of damageCharacteristics) {
          if (change.key.includes(char)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Determine the wounded tint that applies to actor.  Depends on ruleset.
 * @param {TwodsixActor} selectedActor  The actor to check
 * @returns {string} The wounded tint color (as a hex code string).  Color indicates the severity of wounds. TWODSIX.DAMAGECOLORS.minorWoundTint and TWODSIX.DAMAGECOLORS.seriousWoundTint
 */
export function getIconTint(selectedActor: TwodsixActor): string {
  const selectedTraveller = <Traveller>selectedActor.system;
  if ((selectedActor.type === 'animal' && game.settings.get('twodsix', 'animalsUseHits')) || (selectedActor.type === 'robot' && game.settings.get('twodsix', 'robotsUseHits'))) {
    return(getHitsTint(selectedTraveller));
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

export function getHitsTint(selectedTraveller: TwodsixActor): string {
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

export function getCDWoundTint(selectedTraveller: TwodsixActor): string {
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

export function getCELWoundTint(selectedTraveller: TwodsixActor): string {
  let returnVal = '';
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  const maxNonZero = testArray.filter(chr => chr.value !== 0).length;
  const currentZero = testArray.filter(chr => chr.current <= 0  && chr.value !== 0).length;
  if (currentZero === maxNonZero) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (currentZero > 0){
    if (currentZero > 1) {
      returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
    } else {
      returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
    }
  }
  return returnVal;
}

export function getCEWoundTint(selectedTraveller: TwodsixActor): string {
  let returnVal = '';
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  const maxNonZero = testArray.filter(chr => chr.value !== 0).length;
  const currentZero = testArray.filter(chr => chr.current <= 0  && chr.value !== 0).length;
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
      if(testArray.filter(chr => (chr.damage >= chr.value / 2) && chr.value !== 0).length) {
        returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
      } else {
        returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
      }
    }
  }
  return returnVal;
}

export function getCUWoundTint(selectedTraveller: TwodsixActor): string {
  let returnVal = '';
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  const currentZero = testArray.filter(chr => chr.current <= 0  && chr.value !== 0).length;
  if (currentZero === 3) {
    returnVal = TWODSIX.DAMAGECOLORS.deadTint;
  } else if (currentZero === 2) {
    returnVal = TWODSIX.DAMAGECOLORS.seriousWoundTint;
  } else if (currentZero === 1) {
    returnVal = TWODSIX.DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

export function isUnconsciousCE(selectedTraveller: TwodsixActor): boolean {
  const testArray = getPrimaryCharacteristics(selectedTraveller);
  return (testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length === 2);
}

function getPrimaryCharacteristics(selectedTraveller: TwodsixActor) {
  return [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
}

export function getCEAWoundTint(selectedTraveller: TwodsixActor): string {
  let returnVal = '';
  const lfbCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'strength' : 'lifeblood';
  const endCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'endurance' : 'stamina';
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
 * Determine the encumbrance modifier based on the  ratio of encumbrance to the maximum encumbrance.
 * @param {number} ratio  encumbrance/max encumbrance
 * @return {number} encumbrance roll modifier value that gets applied to the encumbered AE
 * @function
 */
function getEncumbranceModifier(ratio:number, encumbranceFraction:number, encumbranceModifier:number, ruleset:string):number {
  if (ratio === 0 ) {
    return 0; //Shoudn't get here
  } else if (["CE"].includes(ruleset)) {
    if (ratio <= encumbranceFraction) {
      return 0;
    } else if (ratio <= encumbranceFraction * 2) {
      return encumbranceModifier;
    } else {
      if (ratio <= encumbranceFraction * 3) {
        return encumbranceModifier * 2;
      } else {
        //console.log(game.i18n.localize("TWODSIX.Warnings.ActorOverloaded"));
        return encumbranceModifier * 20; //Cannot take any actions other than push
      }
    }
  } else if (["CU", "CT"].includes(ruleset)) {
    if (ratio <= 1/3) {
      return 0;
    } else if (ratio <= 2/3) {
      return encumbranceModifier;
    } else {
      return encumbranceModifier * 2;
    }
  } else {
    return encumbranceModifier;
  }
}

function buildEncumbranceChangeData(ruleset: string, modifier: string): { key: string; type: any; value: string; phase: string }[] {
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
