import TwodsixActor from "../entities/TwodsixActor";

Hooks.on('updateActor', async (actor: TwodsixActor, update: Record<string, any>) => {
  if (checkForWounds(update.data)) {
    if (actor.isToken) {
      applyWoundedEffect(<Token>canvas.tokens?.ownedTokens?.find(t => t.id === actor.token?.id));
    } else {
      applyWoundedEffect(<Token>canvas.tokens?.ownedTokens.find(t => t.data.actorId === actor.id));
    }
  }
});

Hooks.on('updateToken', async (scene, token: Record<string, any>, update: Record<string, any>) => {
  if (checkForWounds(update.actorData?.data)) {
    applyWoundedEffect(<Token>canvas.tokens?.ownedTokens.find(t => t.id === token._id));
  }
});

function checkForWounds(data: Record<string, any>): boolean {
  if (!game.settings.get('twodsix', 'useWoundedStatusIndicators') || data === undefined) {
    return false;
  } else {
    switch (game.settings.get('twodsix', 'ruleset')) {
      case 'CD':
        return (!!data.characteristics?.lifeblood);
      case 'CEL':
      case 'CEFTL':
      case 'CE':
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
const DAMAGECOLORS = Object.freeze({
  minorWoundTint: '#FFFF00', // Yellow
  seriousWoundTint: '#FF0000', // Red
  deadTint: '#FFFFFF'  // White
});

async function applyWoundedEffect(selectedToken: Record<string, any>): Promise<void> {
  const tintToApply = getIconTint(selectedToken);

  const woundedEffectLabel = 'Bleeding';
  const deadEffectLabel = 'Dead';
  const unconsciousEffectLabel = 'Unconscious';

  if (!tintToApply) {
    await setEffectState(deadEffectLabel, selectedToken, false);
    await setEffectState(woundedEffectLabel, selectedToken, false);
  } else {
    if (tintToApply === DAMAGECOLORS.deadTint) {
      await setEffectState(deadEffectLabel, selectedToken, true);
      await setEffectState(woundedEffectLabel, selectedToken, false);
      await setEffectState(unconsciousEffectLabel, selectedToken, false);
    } else {
      const oldWoundState = await selectedToken.actor.data.effects.find(eff => eff.data.label === woundedEffectLabel);
      const isAlreadyDead = await selectedToken.actor.data.effects.find(eff => eff.data.label === deadEffectLabel);
      const isAlreadyUnconscious = await selectedToken.actor.data.effects.find(eff => eff.data.label === unconsciousEffectLabel);
      await setEffectState(deadEffectLabel, selectedToken, false);

      if (oldWoundState?.data.tint !== DAMAGECOLORS.seriousWoundTint && !isAlreadyDead && tintToApply === DAMAGECOLORS.seriousWoundTint && !isAlreadyUnconscious) {
        if (['CEQ', 'CEATOM', 'BARBARIC'].includes(game.settings.get('twodsix', 'ruleset').toString())) {
          await setEffectState(unconsciousEffectLabel, selectedToken, true); // Automatic unconsciousness or out of combat
        } else {
          const returnRoll = await selectedToken.actor.characteristicRoll({ characteristic: 'END', difficulty: { mod: 0, target: 8 } }, false);
          if (returnRoll.effect < 0) {
            await setEffectState(unconsciousEffectLabel, selectedToken, true);
          }
        }
      }

      await setEffectState(woundedEffectLabel, selectedToken, true);
      const newEffect = await selectedToken.actor.data.effects.find(eff => eff.data.label === woundedEffectLabel);
      await selectedToken.actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: newEffect.id, tint: tintToApply }]);
    }
  }
}

async function setEffectState(effectLabel: string, targetToken: Record<string, any>, state: boolean): Promise<void> {
  const isAlreadySet = await targetToken.actor.effects.find(eff => eff.data.label === effectLabel);
  if ((typeof isAlreadySet !== 'undefined') !== state) {
    const targetEffect = CONFIG.statusEffects.find(effect => (effect.id === effectLabel.toLocaleLowerCase()));
    await targetToken.toggleEffect(targetEffect);
  }
}

function getIconTint(selectedToken: Record<string, any>): string {
  switch (game.settings.get('twodsix', 'ruleset')) {
    case 'CD':
      return (getCDWoundTint(selectedToken));
    case 'CEL':
    case 'CEFTL':
    case 'CE':
      return (getCEWoundTint(selectedToken));
    case 'CEQ':
    case 'CEATOM':
    case 'BARBARIC':
      return (getCEAWoundTint(selectedToken));
    default:
      return ('');
  }
}

function getCDWoundTint(selectedToken: Record<string, any>): string {
  let returnVal = '';
  if (selectedToken.actor.data.data.characteristics.lifeblood.current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedToken.actor.data.data.characteristics.lifeblood.current < (selectedToken.actor.data.data.characteristics.lifeblood.value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedToken.actor.data.data.characteristics.lifeblood.damage > 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}

function getCEWoundTint(selectedToken: Record<string, any>): string {
  let returnVal = '';
  const testArray = [selectedToken.actor.data.data.characteristics.strength, selectedToken.actor.data.data.characteristics.dexterity, selectedToken.actor.data.data.characteristics.endurance];
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

function getCEAWoundTint(selectedToken: Record<string, any>): string {
  let returnVal = '';
  const lfbCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'strength' : 'lifeblood';
  const endCharacteristic: string = game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics') ? 'endurance' : 'stamina';

  if (selectedToken.actor.data.data.characteristics[lfbCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.deadTint;
  } else if (selectedToken.actor.data.data.characteristics[lfbCharacteristic].current < (selectedToken.actor.data.data.characteristics[lfbCharacteristic].value / 2)) {
    returnVal = DAMAGECOLORS.seriousWoundTint;
  } else if (selectedToken.actor.data.data.characteristics[endCharacteristic].current <= 0) {
    returnVal = DAMAGECOLORS.minorWoundTint;
  }
  return returnVal;
}
