import { Traveller } from "src/types/template";
import TwodsixActor from "../entities/TwodsixActor";
import { _genTranslatedSkillList } from "../utils/TwodsixRollSettings";

Hooks.on('updateActor', async (actor: TwodsixActor, update: Record<string, any>) => {
  if (checkForWounds(update.system) && actor.type === "traveller" && game.user?.isGM) {
    await applyWoundedEffect(actor);
  }
});

function checkForWounds(system: Record<string, any>): boolean {
  if (!game.settings.get('twodsix', 'useWoundedStatusIndicators') || system === undefined) {
    return false;
  } else {
    switch (game.settings.get('twodsix', 'ruleset')) {
      case 'CD':
      case 'CLU':
        return (!!system.characteristics?.lifeblood);
      case 'CEL':
      case 'CEFTL':
      case 'CE':
      case 'OTHER':
        return !!(system.characteristics?.endurance || system.characteristics?.strength || system.characteristics?.dexterity);
      case 'CEQ':
      case 'CEATOM':
      case 'BARBARIC':
        if (game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')) {
          return (!!(system.characteristics?.endurance || system.characteristics?.strength));
        } else if (game.settings.get('twodsix', 'showLifebloodStamina')) {
          return (!!(system.characteristics?.stamina || system.characteristics?.lifeblood));
        }
        return false;
      default:
        return false;
    }
  }
}
export const DAMAGECOLORS = Object.freeze({
  minorWoundTint: '#FFFF00', // Yellow
  seriousWoundTint: '#FF0000', // Red
  deadTint: '#FFFFFF'  // White
});

async function applyWoundedEffect(selectedActor: TwodsixActor): Promise<void> {
  const tintToApply = getIconTint(selectedActor);

  const woundedEffectLabel = 'woundEffect';
  const deadEffectLabel = 'Dead';
  const unconsciousEffectLabel = 'Unconscious';
  const oldWoundState = selectedActor.effects.find(eff => eff.label === woundedEffectLabel);
  const isAlreadyDead = selectedActor.effects.find(eff => eff.label === deadEffectLabel);
  const isAlreadyUnconscious = selectedActor.effects.find(eff => eff.label === unconsciousEffectLabel);

  if (!tintToApply) {
    await setConditionState(deadEffectLabel, selectedActor, false);
    await setWoundedState(woundedEffectLabel, selectedActor, false, tintToApply);
  } else {
    if (tintToApply === DAMAGECOLORS.deadTint) {
      await setConditionState(deadEffectLabel, selectedActor, true);
      await setWoundedState(woundedEffectLabel, selectedActor, false, tintToApply);
      await setConditionState(unconsciousEffectLabel, selectedActor, false);
    } else {
      await setConditionState(deadEffectLabel, selectedActor, false);

      if (['CE', 'OTHER'].includes(game.settings.get('twodsix', 'ruleset').toString())) {
        if (isUnconsciousCE(<Traveller>selectedActor.system) && !isAlreadyUnconscious) {
          await setConditionState(unconsciousEffectLabel, selectedActor, true);
        }
      } else if (oldWoundState?.tint !== DAMAGECOLORS.seriousWoundTint && !isAlreadyDead && tintToApply === DAMAGECOLORS.seriousWoundTint && !isAlreadyUnconscious) {
        if (['CEQ', 'CEATOM', 'BARBARIC'].includes(game.settings.get('twodsix', 'ruleset').toString())) {
          await setConditionState(unconsciousEffectLabel, selectedActor, true); // Automatic unconsciousness or out of combat
        } else {
          const displayShortChar = _genTranslatedSkillList(selectedActor)['END'];
          const returnRoll = await selectedActor.characteristicRoll({ characteristic: 'END', displayLabel: displayShortChar, difficulty: { mod: 0, target: 8 } }, false);
          if (returnRoll && returnRoll.effect < 0) {
            await setConditionState(unconsciousEffectLabel, selectedActor, true);
          }
        }
      }
      await setWoundedState(woundedEffectLabel, selectedActor, true, tintToApply);
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
    const changeData = { key: "system.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: woundModifier.toString() };
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
  switch (game.settings.get('twodsix', 'ruleset')) {
    case 'CD':
    case 'CLU':
      return (getCDWoundTint(selectedTraveller));
    case 'CEL':
    case 'CEFTL':
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
      if (testArray.filter(chr => chr.damage > 0).length > 0) {
        returnVal = DAMAGECOLORS.minorWoundTint;
      }
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
