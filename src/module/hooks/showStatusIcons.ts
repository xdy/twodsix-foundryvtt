// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Traveller } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { TWODSIX } from "../config";
import { getDamageCharacteristics } from "../utils/actorDamage";

Hooks.on('updateActor', async (actor: TwodsixActor, update: Record<string, any>, options: any, userId: string) => {
  if (options.diff) {  //Not certain why this is needed, but opening token editor for tokenActor and cancelling fires updateActor
    if (checkForWounds(update.system, actor.type) && (["traveller", "animal", "robot"].includes(actor.type))) {
      if (game.settings.get('twodsix', 'useWoundedStatusIndicators') && game.user?.id === userId) {
        await applyWoundedEffect(actor).then();
      }
      if (actor.system.hits.lastDelta !== 0 && actor.isOwner ) {
        actor.scrollDamage(actor.system.hits.lastDelta);
      }
    }
    if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && game.user?.id === userId) {
      if (update.system?.characteristics && (actor.type === 'traveller') ) {
        await applyEncumberedEffect(actor).then();
      }
    }
  }
});

Hooks.on("updateItem", async (item: TwodsixItem, update: Record<string, any>, options: any, userId:string) => {
  if (game.user?.id === userId) {
    const owningActor = <TwodsixActor> item.actor;
    if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && owningActor) {
      if ((owningActor.type === 'traveller') && !["skills", "trait", "spell"].includes(item.type) ) {
        if (item.type !== "consumable" || !options.dontSync) {
          await applyEncumberedEffect(owningActor);
        }
      }
    }
    //Needed - for active effects changing damage stats
    if (game.settings.get('twodsix', 'useWoundedStatusIndicators') && owningActor) {
      if (checkForDamageStat(update, owningActor.type) && ["traveller", "animal", "robot"].includes(owningActor.type)) {
        await applyWoundedEffect(<TwodsixActor>item.actor);
      }
    }
  }
});

function checkForWounds(systemUpdates: Record<string, any>, actorType:string): boolean {
  if (systemUpdates !== undefined) {
    const damageCharacteristics = getDamageCharacteristics(actorType);
    for (const characteristic of damageCharacteristics) {
      if (systemUpdates.characteristics) {
        if (characteristic in systemUpdates.characteristics) {
          return true;
        }
      }
    }
  }
  return false;
}

function checkForDamageStat (update: any, actorType: string): boolean {
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

/*function checkForEncumbered(systemUpdates: Record<string, any>): boolean {
  if (systemUpdates !== undefined) {
    if (systemUpdates.equipped) {
      return true;
    }
  }
  return false;
}*/

export const DAMAGECOLORS = Object.freeze({
  minorWoundTint: '#FFFF00', // Yellow
  seriousWoundTint: '#FF0000', // Red
  deadTint: '#FFFFFF'  // White
});

export const effectType = Object.freeze({
  dead: 'EFFECT.StatusDead',
  wounded: 'EFFECT.StatusWounded',
  unconscious: 'EFFECT.StatusUnconscious',
  encumbered: 'EFFECT.StatusEncumbered'
});

async function applyWoundedEffect(selectedActor: TwodsixActor): Promise<void> {
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
    if (tintToApply === DAMAGECOLORS.deadTint) {
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
      if (selectedActor.type !== 'animal'  && selectedActor.type !== 'robot' && !isCurrentlyDead /*&& oldWoundState?.tint !== DAMAGECOLORS.seriousWoundTint*/) {
        await checkUnconsciousness(selectedActor, oldWoundState, tintToApply);
      }
      if (tintToApply !== oldWoundState?.tint) {
        await setWoundedState(selectedActor, true, tintToApply);
      }
    }
  }
}

export async function applyEncumberedEffect(selectedActor: TwodsixActor): Promise<void> {

  //Clean-up a localization issue
  /*if (game.i18n.localize(effectType.encumbered) !== "Encumbered") {
    const oldEncumbered = await selectedActor.effects.filter(eff => eff.statuses.has("encumbered"));
    if (oldEncumbered.length > 0) {
      const oldIdList = await oldEncumbered.map(i => i.id);
      await selectedActor.deleteEmbeddedDocuments("ActiveEffect", oldIdList);
    }
  }*/

  const isCurrentlyEncumbered = await selectedActor.effects.filter(eff => eff.statuses.has('encumbered'));

  let state = false;
  const maxEncumbrance = selectedActor.system.encumbrance.max; //selectedActor.getMaxEncumbrance()
  if (maxEncumbrance === 0 && selectedActor.system.encumbrance.value > 0) {
    state = true;
  } else if (maxEncumbrance > 0) {
    const ratio = /*selectedActor.getActorEncumbrance()*/ selectedActor.system.encumbrance.value / maxEncumbrance;
    state = (ratio > parseFloat(await game.settings.get('twodsix', 'encumbranceFraction')));
  }
  if (isCurrentlyEncumbered.length > 0) {
    const idList = await isCurrentlyEncumbered.map(i => i.id);
    if (state === true) {
      await idList.pop();
    }
    if(idList.length > 0) {
      await selectedActor.deleteEmbeddedDocuments("ActiveEffect", idList);
    }
  } else if (state === true  && isCurrentlyEncumbered.length === 0) {
    const modifier = game.settings.get('twodsix', 'encumbranceModifier');
    const changeData = [{
      key: "system.conditions.encumberedEffect",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: modifier.toString()
    }];
    await selectedActor.createEmbeddedDocuments("ActiveEffect", [{
      name: game.i18n.localize(effectType.encumbered),
      icon: "systems/twodsix/assets/icons/weight.svg",
      changes: changeData,
      statuses: ["encumbered"]
    }]);
    //const newEffect = selectedActor.effects.find(eff => eff.name === effectType.encumbered);
    //await newEffect?.setFlag("core", "statusId", "weakened"); //Kludge to make icon appear on token
  }
}

async function checkUnconsciousness(selectedActor: TwodsixActor, oldWoundState: ActiveEffect | undefined, tintToApply: string) {
  const isAlreadyUnconscious = selectedActor.effects.find(eff => eff.statuses.has('unconscious'));
  const isAlreadyDead = selectedActor.effects.find(eff => eff.statuses.has('dead'));
  const rulesSet = game.settings.get('twodsix', 'ruleset').toString();
  if (!isAlreadyUnconscious && !isAlreadyDead) {
    if (['CE', 'OTHER'].includes(rulesSet)) {
      if (isUnconsciousCE(<Traveller>selectedActor.system)) {
        await setConditionState('unconscious', selectedActor, true);
      }
    } else if (oldWoundState?.tint !== DAMAGECOLORS.seriousWoundTint && tintToApply === DAMAGECOLORS.seriousWoundTint) {
      if (['CEQ', 'CEATOM', 'BARBARIC'].includes(rulesSet)) {
        await setConditionState('unconscious', selectedActor, true); // Automatic unconsciousness or out of combat
      } else {
        const setDifficulty = Object.values(TWODSIX.DIFFICULTIES[(game.settings.get('twodsix', 'difficultyListUsed'))]).find(e => e.target=== 8); //always 8+
        const returnRoll = await selectedActor.characteristicRoll({ rollModifiers: {characteristic: 'END'}, difficulty: setDifficulty}, false);
        if (returnRoll && returnRoll.effect < 0) {
          await setConditionState('unconscious', selectedActor, true);
        }
      }
    }
  }
}

async function setConditionState(effectStatus: string, targetActor: TwodsixActor, state: boolean): Promise<void> {
  const isAlreadySet = targetActor.effects.filter(eff => eff.statuses.has(effectStatus));
  const targetEffect = CONFIG.statusEffects.find(statusEffect => (statusEffect.id === effectStatus));

  let targetToken = {};
  if(targetActor.isToken) {
    targetToken = <Token>targetActor.token.object;
  } else {
    targetToken = <Token>canvas.tokens?.ownedTokens.find(t => t.actor?.id === targetActor.id);
    if (!targetToken?.document.isLinked) {
      return; //unlinked actor token found
    }
  }

  if (isAlreadySet.length > 1  && targetToken) {
    //Need to get rid of duplicates
    for (let i = 1; i < isAlreadySet.length; i++) {
      await (<Token>targetToken).toggleEffect(targetEffect, {active: false});
    }
  }

  if ((isAlreadySet.length > 0) !== state) {
    if (targetToken && targetEffect) {
      if (effectStatus === 'dead') {
        await (<Token>targetToken).toggleEffect(targetEffect, {active: state, overlay: false});
        // Set defeated if in combat
        const fighters = game.combats?.active?.combatants;
        const combatant = fighters?.find((f: Combatant) => f.tokenId === (<Token>targetToken).id);
        if (combatant !== undefined) {
          await combatant.update({defeated: state});
        }
      } else {
        await (<Token>targetToken).toggleEffect(targetEffect, {active: state});
      }
    }
  }
}

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
      case DAMAGECOLORS.minorWoundTint:
        woundModifier = game.settings.get('twodsix', 'minorWoundsRollModifier');
        break;
      case DAMAGECOLORS.seriousWoundTint:
        woundModifier = game.settings.get('twodsix', 'seriousWoundsRollModifier');
        break;
    }
    const changeData = { key: "system.conditions.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: woundModifier.toString() };//
    if (!currentEffectId) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [{
        name: game.i18n.localize(effectType.wounded),
        icon: "icons/svg/blood.svg",
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
        return (getCELWoundTint(selectedTraveller));
      case 'CE':
      case 'OTHER':
        return (getCEWoundTint(selectedTraveller));
      case 'CEQ':
      case 'CEATOM':
      case 'BARBARIC':
        return (getCEAWoundTint(selectedTraveller));
      default:
        return ('');
    }
  }
}

export function getHitsTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  if (selectedTraveller.characteristics.lifeblood.current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics.lifeblood.current < (selectedTraveller.characteristics.lifeblood.value / 3)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics.lifeblood.current < (2 * selectedTraveller.characteristics.lifeblood.value / 3)) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

export function getCDWoundTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  if (selectedTraveller.characteristics.lifeblood.current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics.lifeblood.current < (selectedTraveller.characteristics.lifeblood.value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics.lifeblood.damage > 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

export function getCELWoundTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
  const maxNonZero = testArray.filter(chr => chr.value !== 0).length;
  const currentZero = testArray.filter(chr => chr.current <= 0  && chr.value !== 0).length;
  if (currentZero === maxNonZero) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (currentZero > 0){
    if (currentZero > 1) {
      returnVal = DAMAGECOLORS.seriousWoundTint;
    } else {
      returnVal = DAMAGECOLORS.minorWoundTint;
    }
  }
  return returnVal;
}

export function getCEWoundTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
  const maxNonZero = testArray.filter(chr => chr.value !== 0).length;
  const currentZero = testArray.filter(chr => chr.current <= 0  && chr.value !== 0).length;
  const numDamaged = testArray.filter(chr => chr.damage > 0 && chr.value !== 0).length;
  if (currentZero === maxNonZero) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (numDamaged > 0) {
    if (maxNonZero > 1) {
      if (numDamaged === maxNonZero) {
        returnVal = DAMAGECOLORS.seriousWoundTint;
      } else {
        returnVal = DAMAGECOLORS.minorWoundTint;
      }
    } else {
      if(testArray.filter(chr => (chr.damage >= chr.value / 2) && chr.value !== 0).length) {
        returnVal = DAMAGECOLORS.seriousWoundTint;
      } else {
        returnVal = DAMAGECOLORS.minorWoundTint;
      }
    }
  }
  return returnVal;
}

export function isUnconsciousCE(selectedTraveller: Traveller): boolean {
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
  return (testArray.filter(chr => chr.current <= 0 && chr.value !== 0).length === 2);
}

export function getCEAWoundTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  const lfbCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'strength' : 'lifeblood';
  const endCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'endurance' : 'stamina';
  const currentHits = selectedTraveller.characteristics[lfbCharacteristic].current + selectedTraveller.characteristics[endCharacteristic].current;
  //const totalHits = selectedTraveller.characteristics[lfbCharacteristic].value + selectedTraveller.characteristics[endCharacteristic].value;
  if (currentHits <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics[lfbCharacteristic].current < (selectedTraveller.characteristics[lfbCharacteristic].value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics[endCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}


