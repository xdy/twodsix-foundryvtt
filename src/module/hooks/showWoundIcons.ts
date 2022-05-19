//import { ActorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/module.mjs";
import TwodsixActor from "../entities/TwodsixActor";
import { _genTranslatedSkillList } from "../utils/TwodsixRollSettings";

Hooks.on('updateActor', async (actor: TwodsixActor, update: Record<string, any>) => {
  if (checkForWounds(update.data)) {
    applyWoundedEffect(actor);
  }
});
//A check for token update doesn't seem to be needed.  But keep code just in case
/*Hooks.on('updateToken', async (token: TokenDocument, update: Record<string, any>) => {
  if (checkForWounds(update?.data)) {
    applyWoundedEffect(<Token>canvas.tokens?.ownedTokens.find(t => t.id === token.id));
  }
});*/

function checkForWounds(data: Record<string, any>): boolean {
  if (!game.settings.get('twodsix', 'useWoundedStatusIndicators') || data === undefined) {
    return false;
  } else {
    switch (game.settings.get('twodsix', 'ruleset')) {
      case 'CD':
      case 'CLU':
        return (!!data.characteristics?.lifeblood);
      case 'CEL':
      case 'CEFTL':
      case 'CE':
      case 'OTHER':
        return !!(data.characteristics?.endurance || data.characteristics?.strength || data.characteristics?.dexterity);
      case 'CEQ':
      case 'CEATOM':
      case 'BARBARIC':
        if (game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')) {
          return (!!(data.characteristics?.endurance || data.characteristics?.strength));
        } else if (game.settings.get('twodsix', 'showLifebloodStamina')) {
          return (!!(data.characteristics?.stamina || data.characteristics?.lifeblood));
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

  if (!tintToApply) {
    await setConditionState(deadEffectLabel, selectedActor, false);
    await setEffectState(woundedEffectLabel, selectedActor, false, tintToApply);
  } else {
    if (tintToApply === DAMAGECOLORS.deadTint) {
      await setConditionState(deadEffectLabel, selectedActor, true);
      await setEffectState(woundedEffectLabel, selectedActor, false, tintToApply);
      await setConditionState(unconsciousEffectLabel, selectedActor, false);
    } else {
      const oldWoundState = await selectedActor.data.effects.find(eff => eff.data.label === woundedEffectLabel);
      const isAlreadyDead = await selectedActor.data.effects.find(eff => eff.data.label === deadEffectLabel);
      const isAlreadyUnconscious = await selectedActor.data.effects.find(eff => eff.data.label === unconsciousEffectLabel);
      await setConditionState(deadEffectLabel, selectedActor, false);

      if (oldWoundState?.data.tint !== DAMAGECOLORS.seriousWoundTint && !isAlreadyDead && tintToApply === DAMAGECOLORS.seriousWoundTint && !isAlreadyUnconscious) {
        if (['CEQ', 'CEATOM', 'BARBARIC', 'CE', 'OTHER'].includes(game.settings.get('twodsix', 'ruleset').toString())) {
          await setConditionState(unconsciousEffectLabel, selectedActor, true); // Automatic unconsciousness or out of combat
        } else {
          const displayShortChar = _genTranslatedSkillList(selectedActor)['END'];
          const returnRoll = await selectedActor.characteristicRoll({ characteristic: 'END', displayLabel: displayShortChar, difficulty: { mod: 0, target: 8 } }, false);
          if (returnRoll && returnRoll.effect < 0) {
            await setConditionState(unconsciousEffectLabel, selectedActor, true);
          }
        }
      }
      await setEffectState(woundedEffectLabel, selectedActor, true, tintToApply);
    }
  }
}

async function setConditionState(effectLabel: string, targetActor: TwodsixActor, state: boolean): Promise<void> {
  const isAlreadySet = await targetActor?.effects.find(eff => eff.data.label === effectLabel);
  if ((typeof isAlreadySet !== 'undefined') !== state) {
    const targetEffect = CONFIG.statusEffects.find(effect => (effect.id === effectLabel.toLocaleLowerCase()));
    let targetToken = {};
    if(targetActor.isToken) {
      targetToken = <Token>canvas.tokens?.ownedTokens.find(t => t.id === targetActor.token?.id);
    } else {
      targetToken = <Token>canvas.tokens?.ownedTokens.find(t => t.data.actorId === targetActor.id);
    }
    if (targetToken) {
      await (<Token>targetToken).toggleEffect(targetEffect);
    }
  }
}

async function setEffectState(effectLabel: string, targetActor: TwodsixActor, state: boolean, tint: string): Promise<void> {
  const isAlreadySet = await targetActor?.effects.find(eff => eff.data.label === effectLabel);
  if (isAlreadySet && state === false) {
    if(isAlreadySet.id) {
      await targetActor.deleteEmbeddedDocuments("ActiveEffect", [isAlreadySet.id]);
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
    const changeData = { key: "data.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: woundModifier.toString() };
    if (isAlreadySet === undefined && state === true) {
      await targetActor.createEmbeddedDocuments("ActiveEffect", [{
        label: effectLabel,
        icon: "icons/svg/blood.svg",
        tint: tint,
        changes: [changeData]
      }]);
      const newEffect = await targetActor.effects.find(eff => eff.data.label === effectLabel);
      newEffect?.setFlag("core", "statusId", "bleeding"); /*FIX*/
    } else if (isAlreadySet && state === true) {
      await targetActor.updateEmbeddedDocuments('ActiveEffect', [{ _id: isAlreadySet.id, tint: tint, changes: [changeData] }]);
    }
  }
}

export function getIconTint(selectedActor: Record<string, any>): string {
  switch (game.settings.get('twodsix', 'ruleset')) {
    case 'CD':
    case 'CLU':
      return (getCDWoundTint(selectedActor));
    case 'CEL':
    case 'CEFTL':
    case 'CE':
    case 'OTHER':
      return (getCEWoundTint(selectedActor));
    case 'CEQ':
    case 'CEATOM':
    case 'BARBARIC':
      return (getCEAWoundTint(selectedActor));
    default:
      return ('');
  }
}

export function getCDWoundTint(selectedActor: Record<string, any>): string {
  let returnVal = '';
  if (selectedActor.data.data.characteristics.lifeblood.current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedActor.data.data.characteristics.lifeblood.current < (selectedActor.data.data.characteristics.lifeblood.value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedActor.data.data.characteristics.lifeblood.damage > 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

export function getCEWoundTint(selectedActor: Record<string, any>): string {
  let returnVal = '';
  const testArray = [selectedActor.data.data.characteristics.strength, selectedActor.data.data.characteristics.dexterity, selectedActor.data.data.characteristics.endurance];
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

export function getCEAWoundTint(selectedActor: Record<string, any>): string {
  let returnVal = '';
  const lfbCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'strength' : 'lifeblood';
  const endCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'endurance' : 'stamina';

  if (selectedActor.data.data.characteristics[lfbCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedActor.data.data.characteristics[lfbCharacteristic].current < (selectedActor.data.data.characteristics[lfbCharacteristic].value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedActor.data.data.characteristics[endCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}
