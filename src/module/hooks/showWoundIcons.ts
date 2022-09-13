// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Traveller } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { getDamageCharacteristics } from "../utils/actorDamage";
import { _genTranslatedSkillList } from "../utils/TwodsixRollSettings";

Hooks.on('updateActor', async (actor: TwodsixActor, update: Record<string, any>) => {
  if (game.settings.get('twodsix', 'useWoundedStatusIndicators')) {
    if (checkForWounds(update.system, actor.type) && (actor.type === 'traveller' || actor.type === 'animal') && game.user?.isGM) {
      await applyWoundedEffect(actor);
    }
  }
});

function checkForWounds(systemUpdates: Record<string, any>, actorType:string): boolean {
  if (systemUpdates === undefined) {
    return false;
  } else {
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

export const DAMAGECOLORS = Object.freeze({
  minorWoundTint: '#FFFF00', // Yellow
  seriousWoundTint: '#FF0000', // Red
  deadTint: '#FFFFFF'  // White
});

export const effectType = Object.freeze({
  dead: 'Dead',
  wounded: 'Wounded',
  unconscious: 'Unconscious'
});

async function applyWoundedEffect(selectedActor: TwodsixActor): Promise<void> {
  const tintToApply = getIconTint(selectedActor);
  const oldWoundState = selectedActor.effects.find(eff => eff.label === effectType.wounded);
  const isCurrentlyDead = selectedActor.effects.find(eff => eff.label === effectType.dead);

  if (!tintToApply) {
    await setConditionState(effectType.dead, selectedActor, false);
    await setWoundedState(effectType.wounded, selectedActor, false, tintToApply);
  } else {
    if (tintToApply === DAMAGECOLORS.deadTint) {
      await setConditionState(effectType.dead, selectedActor, true);
      await setWoundedState(effectType.wounded, selectedActor, false, tintToApply);
      await setConditionState(effectType.unconscious, selectedActor, false);
    } else {
      await setConditionState(effectType.dead, selectedActor, false);

      if (selectedActor.type !== 'animal' && !isCurrentlyDead && oldWoundState?.tint !== DAMAGECOLORS.seriousWoundTint) {
        await checkUnconsciousness(selectedActor, oldWoundState, tintToApply);
      }
      await setWoundedState(effectType.wounded, selectedActor, true, tintToApply);
    }
  }
}

async function checkUnconsciousness(selectedActor: TwodsixActor, oldWoundState: ActiveEffect | undefined, tintToApply: string) {
  const isAlreadyUnconscious = selectedActor.effects.find(eff => eff.label === effectType.unconscious);
  const isAlreadyDead = selectedActor.effects.find(eff => eff.label === effectType.dead);
  const rulesSet = game.settings.get('twodsix', 'ruleset').toString();
  if (!isAlreadyUnconscious && !isAlreadyDead) {
    if (['CE', 'OTHER'].includes(rulesSet)) {
      if (isUnconsciousCE(<Traveller>selectedActor.system)) {
        await setConditionState(effectType.unconscious, selectedActor, true);
      }
    } else if (oldWoundState?.tint !== DAMAGECOLORS.seriousWoundTint && tintToApply === DAMAGECOLORS.seriousWoundTint) {
      if (['CEQ', 'CEATOM', 'BARBARIC'].includes(rulesSet)) {
        await setConditionState(effectType.unconscious, selectedActor, true); // Automatic unconsciousness or out of combat
      } else {
        const displayShortChar = _genTranslatedSkillList(selectedActor)['END'];
        const returnRoll = await selectedActor.characteristicRoll({ characteristic: 'END', displayLabel: displayShortChar, difficulty: { mod: 0, target: 8 } }, false);
        if (returnRoll && returnRoll.effect < 0) {
          await setConditionState(effectType.unconscious, selectedActor, true);
        }
      }
    }
  }
}

async function setConditionState(effectLabel: string, targetActor: TwodsixActor, state: boolean): Promise<void> {
  const isAlreadySet = targetActor.effects.filter(eff => eff.label === effectLabel);
  const targetEffect = CONFIG.statusEffects.find(effect => (effect.id === effectLabel.toLocaleLowerCase()));

  let targetToken = {};
  if(targetActor.isToken) {
    targetToken = <Token>canvas.tokens?.ownedTokens.find(t => t.id === targetActor.token?.id);
  } else {
    targetToken = <Token>canvas.tokens?.ownedTokens.find(t => t.actor?.id === targetActor.id);
  }
  if (isAlreadySet.length > 1) {
    //Need to get rid of duplicates
    for (let i = 1; i < isAlreadySet.length; i++) {
      await (<Token>targetToken).toggleEffect(targetEffect, {active: false});
    }
  }

  if ((isAlreadySet.length > 0) !== state) {

    if (targetToken && targetEffect) {
      if (effectLabel === "Dead" ) {
        await (<Token>targetToken).toggleEffect(targetEffect, {active: state, overlay: true});
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

async function setWoundedState(effectLabel: string, targetActor: TwodsixActor, state: boolean, tint: string): Promise<void> {
  const isAlreadySet = await targetActor?.effects.filter(eff => eff.label === effectLabel);
  if (isAlreadySet.length > 0 && (state === false)) {
    const idList= isAlreadySet.map(i => <string>i.id);
    if(idList.length > 0) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", idList);
    }
  } else {
    let woundModifier = 0;
    switch (tint) {
      case DAMAGECOLORS.minorWoundTint:
        woundModifier = game.settings.get('twodsix', 'minorWoundsRollModifier');
        break;
      case DAMAGECOLORS.seriousWoundTint:
        woundModifier = game.settings.get('twodsix', 'seriousWoundsRollModifier');
        break;
    }
    const changeData = { key: "system.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: woundModifier.toString() };//
    if (isAlreadySet.length === 0 && state === true) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [{
        label: effectLabel,
        icon: "icons/svg/blood.svg",
        tint: tint,
        changes: [changeData]
      }]);
      const newEffect = await targetActor.effects.find(eff => eff.label === effectLabel);
      newEffect?.setFlag("core", "statusId", "bleeding"); /*FIX*/
    } else if (isAlreadySet.length > 0 && state === true) {
      await targetActor.updateEmbeddedDocuments('ActiveEffect', [{ _id: isAlreadySet[0].id, tint: tint, changes: [changeData] }]);
    }
  }
}

export function getIconTint(selectedActor: TwodsixActor): string {
  const selectedTraveller = <Traveller>selectedActor.system;
  if (selectedActor.type === 'animal' && game.settings.get('twodsix', 'animalsUseHits')) {
    return(getHitsTint(selectedTraveller));
  } else {
    switch (game.settings.get('twodsix', 'ruleset')) {
      case 'CD':
      case 'CLU':
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
  switch (testArray.filter(chr => chr.current <= 0).length) {
    case 0:
      //if (testArray.filter(chr => chr.damage > 0).length > 0) {
      //  returnVal = DAMAGECOLORS.minorWoundTint;
      //}
      break;
    case 1:
      returnVal = DAMAGECOLORS.minorWoundTint;
      break;
    case 2:
      returnVal = DAMAGECOLORS.seriousWoundTint;
      break;
    case 3:
      returnVal = DAMAGECOLORS.deadTint;
      break;
    default:
      break;
  }
  return returnVal;
}

export function getCEWoundTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
  switch (testArray.filter(chr => chr.current <= 0).length) {
    case 0:
      if (testArray.filter(chr => chr.damage > 0).length > 0) {
        returnVal = DAMAGECOLORS.minorWoundTint;
      }
      break;
    case 1:
    case 2:
      returnVal = DAMAGECOLORS.minorWoundTint;
      break;
    case 3:
      returnVal = DAMAGECOLORS.deadTint;
      break;
    default:
      break;
  }
  if ((testArray.filter(chr => chr.damage > 0).length) === 3 && returnVal !== DAMAGECOLORS.deadTint) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  }
  return returnVal;
}
export function isUnconsciousCE(selectedTraveller: Traveller): boolean {
  const testArray = [selectedTraveller.characteristics.strength, selectedTraveller.characteristics.dexterity, selectedTraveller.characteristics.endurance];
  return (testArray.filter(chr => chr.current <= 0).length === 2);
}

export function getCEAWoundTint(selectedTraveller: Traveller): string {
  let returnVal = '';
  const lfbCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'strength' : 'lifeblood';
  const endCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'endurance' : 'stamina';

  if (selectedTraveller.characteristics[lfbCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedTraveller.characteristics[lfbCharacteristic].current < (selectedTraveller.characteristics[lfbCharacteristic].value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedTraveller.characteristics[endCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}
