// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Traveller } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { TWODSIX } from "../config";
import { getDamageCharacteristics } from "./actorDamage";
import { TwodsixActiveEffect } from "../entities/TwodsixActiveEffect";

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
      setConditionState('unconscious', selectedActor, false);
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
  const isCurrentlyEncumbered = await selectedActor.effects.filter(eff => eff.statuses.has('encumbered'));
  let state = false;
  let ratio = 0;
  let aeToKeep: TwodsixActiveEffect | undefined = undefined;
  const maxEncumbrance = selectedActor.system.encumbrance.max; //selectedActor.getMaxEncumbrance()

  //Determined whether encumbered if not dead
  if (selectedActor.system.hits.value > 0) {
    if (maxEncumbrance === 0 && selectedActor.system.encumbrance.value > 0) {
      state = true;
      ratio = 1;
    } else if (maxEncumbrance > 0) {
      ratio = /*selectedActor.getActorEncumbrance()*/ selectedActor.system.encumbrance.value / maxEncumbrance;
      state = (ratio > parseFloat(game.settings.get('twodsix', 'encumbranceFraction'))); //remove await
    }
  }

  // Delete encumbered AE's if uneeded or more than one
  if (isCurrentlyEncumbered.length > 0) {
    if (state === true) {
      aeToKeep = isCurrentlyEncumbered.pop();
    }
    if(isCurrentlyEncumbered.length > 0) {
      const idList = isCurrentlyEncumbered.map(i => i.id);
      await selectedActor.deleteEmbeddedDocuments("ActiveEffect", idList);
    }
  }

  //Define AE if actor is encumbered
  if (state === true) {
    const modifier:string = getEncumbranceModifier(ratio).toString();
    let changeData: { key: string; mode: any; value: string; }[];
    if (game.settings.get('twodsix', 'ruleset') === 'CT') {
      changeData = [{
        key: "system.characteristics.strength.value",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: modifier
      },
      {
        key: "system.characteristics.dexterity.value",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: modifier
      },
      {
        key: "system.characteristics.endurance.value",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: modifier
      }];
    } else {
      changeData = [{
        key: "system.conditions.encumberedEffect",
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: modifier
      }];
    }

    if (game.settings.get('twodsix', 'ruleset') === 'CU') {
      changeData.push({
        key: "system.movement.walk",
        mode: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
        value: 0.75
      });
    }

    if (!aeToKeep) {
      await selectedActor.createEmbeddedDocuments("ActiveEffect", [{
        name: game.i18n.localize(TWODSIX.effectType.encumbered),
        img: "systems/twodsix/assets/icons/weight.svg",
        changes: changeData,
        statuses: ["encumbered"]
      }], {dontSync: true, noHook: true});
    } else {
      if (changeData[0].value !== aeToKeep.changes[0].value) {
        await aeToKeep.update({changes: changeData });
      }
    }
  }
}


/**
 * Determine whether actor becomes unconscious based on ruleset. Depending on ruleset, may make endurance roll.
 * @param {TwodsixActor} selectedActor  The actor to check
 * @param {TwodsixActiveEffect | undefined} oldWoundState The current wounded AE for actor
 * @param {string} tintToApply The wounded state tint to be applied (the updated tint)
 */
async function checkUnconsciousness(selectedActor: TwodsixActor, oldWoundState: TwodsixActiveEffect | undefined, tintToApply: string): Promise<void> {
  const isAlreadyUnconscious = selectedActor.effects.find(eff => eff.statuses.has('unconscious'));
  const isAlreadyDead = selectedActor.effects.find(eff => eff.statuses.has('dead'));
  const rulesSet = game.settings.get('twodsix', 'ruleset'); //toString shouldn't be needed
  if (!isAlreadyUnconscious && !isAlreadyDead) {
    if (['CE', 'AC', 'CU', 'OTHER'].includes(rulesSet)) {
      if (isUnconsciousCE(<Traveller>selectedActor.system)) {
        await setConditionState('unconscious', selectedActor, true);
      }
    } else if (['CT'].includes(rulesSet)) {
      if (oldWoundState === undefined && [TWODSIX.DAMAGECOLORS.minorWoundTint, TWODSIX.DAMAGECOLORS.seriousWoundTint].includes(tintToApply)) {
        await setConditionState('unconscious', selectedActor, true); // Automatic unconsciousness or out of combat
      }
    } else if (oldWoundState?.tint.css !== TWODSIX.DAMAGECOLORS.seriousWoundTint && tintToApply === TWODSIX.DAMAGECOLORS.seriousWoundTint) {
      if (['CEQ', 'CEATOM', 'BARBARIC'].includes(rulesSet)) {
        await setConditionState('unconscious', selectedActor, true); // Automatic unconsciousness or out of combat
      } else {
        const setDifficulty = Object.values(TWODSIX.DIFFICULTIES[(game.settings.get('twodsix', 'difficultyListUsed'))]).find(e => e.target=== 8); //always 8+
        const returnRoll = await selectedActor.characteristicRoll({
          rollModifiers: {characteristic: 'END'},
          difficulty: setDifficulty,
          extraFlavor: game.i18n.localize("TWODSIX.Rolls.MakesUncRoll")
        }, false);
        if (returnRoll && returnRoll.effect < 0) {
          await setConditionState('unconscious', selectedActor, true);
        }
      }
    }
  }
}

/**
 * Toggles an effect status/condition on an actor.
 * @param {string} effectStatus status/condition name to change
 * @param {TwodsixActor} targetActor  The actor to update
 * @param {boolean} state Whether the status is enabled
 */
async function setConditionState(effectStatus: string, targetActor: TwodsixActor, state: boolean): Promise<void> {
  const isAlreadySet = targetActor.effects.filter(eff => eff.statuses.has(effectStatus));
  const targetEffect = CONFIG.statusEffects.find(statusEffect => (statusEffect.id === effectStatus));

  if (isAlreadySet.length > 1) {
    //Need to get rid of duplicates
    for (let i = 1; i < isAlreadySet.length; i++) {
      await targetActor.toggleStatusEffect(targetEffect.id, {active: false});
    }
  }

  if ((isAlreadySet.length > 0) !== state) {
    if (targetEffect) {
      if (effectStatus === 'dead') {
        await targetActor.toggleStatusEffect(targetEffect.id, {active: state, overlay: false});

        // Set defeated if in combat (no longer needed in v12)
        /*const fighters = game.combats?.active?.combatants;
        const combatant = fighters?.find((f: Combatant) => f.actorId === targetActor.id);
        if (combatant !== undefined) {
          await combatant.update({defeated: state});
        }*/
      } else {
        await targetActor.toggleStatusEffect(targetEffect.id, {active: state});
      }
    }
  }
}

/**
 * Determine whether wounded effect applies to actor.  Update wounded AE, if necessary.
 * @param {TwodsixActor} targetActor  The actor to check
 * @param {boolean} state whether wounded effect applies
 * @param {string} tint The wounded tint color (as a hex code string).  Color indicates the severity of wounds. TWODSIX.DAMAGECOLORS.minorWoundTint and TWODSIX.DAMAGECOLORS.seriousWoundTint
 */
async function setWoundedState(targetActor: TwodsixActor, state: boolean, tint: string): Promise<void> {
  const isAlreadySet = await targetActor?.effects.filter(eff => eff.statuses.has('wounded'));
  let currentEffectId = "";
  //Clean up effects
  if (isAlreadySet.length > 0) {
    const idList = isAlreadySet.map(i => i.id);
    if (state) {
      currentEffectId = idList.pop();
    }
    if(idList.length > 0) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", idList);
    }
  }
  //Set effect if state true
  if (state) {
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
    if (game.settings.get('twodsix', 'ruleset') === 'AC' && tint === TWODSIX.DAMAGECOLORS.seriousWoundTint) {
      changeData = { key: "system.movement.walk", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: 1.5 };
    } else {
      changeData = { key: "system.conditions.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: woundModifier.toString() };
    }
    //
    if (!currentEffectId) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [{
        name: game.i18n.localize(TWODSIX.effectType.wounded),
        img: "icons/svg/blood.svg",
        tint: tint,
        changes: [changeData],
        statuses: ['wounded']
      }]);
    } else {
      const currentEfffect = targetActor.effects.get(currentEffectId);
      if (currentEfffect.tint !== tint) {
        await targetActor.updateEmbeddedDocuments('ActiveEffect', [{ _id: currentEffectId, tint: tint, changes: [changeData] }]);
      }
    }
  }
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
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
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
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
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
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
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
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
  return (testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length === 2);
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
function getEncumbranceModifier(ratio:number):number {
  const ruleset = game.settings.get('twodsix', 'ruleset');
  if (ratio === 0 ) {
    return 0; //Shoudn't get here
  } else if (['CE'].includes(ruleset)) {
    if (ratio <= game.settings.get('twodsix', 'encumbranceFraction')) {
      return 0;
    } else if (ratio <= game.settings.get('twodsix', 'encumbranceFraction') * 2) {
      return game.settings.get('twodsix', 'encumbranceModifier');
    } else {
      if (ratio <= game.settings.get('twodsix', 'encumbranceFraction') * 3) {
        return game.settings.get('twodsix', 'encumbranceModifier') * 2;
      } else {
        //console.log(game.i18n.localize("TWODSIX.Warnings.ActorOverloaded"));
        return game.settings.get('twodsix', 'encumbranceModifier') * 20; //Cannot take any actions other than push
      }
    }
  } else if (['CU', 'CT'].includes(ruleset)) {
    if (ratio <= 1/3) {
      return 0;
    } else if (ratio <= 2/3) {
      return game.settings.get('twodsix', 'encumbranceModifier');
    } else {
      return game.settings.get('twodsix', 'encumbranceModifier') * 2;
    }
  } else {
    return game.settings.get('twodsix', 'encumbranceModifier');
  }
}
