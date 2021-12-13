import TwodsixActor from "../entities/TwodsixActor";
import { getDamageCharacteristics } from "../utils/actorDamage";
import { mergeDeep } from "../utils/utils";

function getCurrentHits(...args: Record<string, any>[]) {
  const characteristics = mergeDeep({}, ...args);
  const hitsCharacteristics: string[] = getDamageCharacteristics();

  return Object.entries(characteristics).reduce((hits, [key, chr]) => {
    if (hitsCharacteristics.includes(key)) {
      hits.value += chr.value-chr.damage;
      hits.max += chr.value;
    }
    return hits;
  }, {value: 0, max: 0});
}

Hooks.on('preUpdateActor', async (actor:TwodsixActor, update:Record<string, any>) => {
  if (update.data?.characteristics) {
    update.data.hits = getCurrentHits(actor.data.data.characteristics, update.data.characteristics);
  }
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('preUpdateToken', async (scene, token:Record<string, any>, update:Record<string, any>) => {
  if (update.actorData?.data?.characteristics) {
    const actor = game.actors.get(token.actorId);
    update.actorData.data.hits = getCurrentHits(
      // @ts-ignore
      actor.data.data.characteristics,
      token.actorData?.data?.characteristics ?? {},
      update.actorData.data.characteristics
    );
  }
});

Hooks.on('updateActor', async (actor:TwodsixActor, update:Record<string, any>) => {
  if (checkForWounds(update.data)) {
    if (actor.isToken) {
      applyWoundedEffect(canvas.tokens.ownedTokens.find(t => t.id === actor.token.id));
    } else {
      applyWoundedEffect(canvas.tokens.ownedTokens.find(t => t.data.actorId === actor.id));
    }
  }
});

Hooks.on('updateToken', async (scene, token:Record<string, any>, update:Record<string, any>) => {
  if (checkForWounds(update.actorData?.data)) {
    applyWoundedEffect(canvas.tokens.ownedTokens.find(t => t.id === token._id));
  }
});

function checkForWounds (data: Record<string, any>):boolean {
  if (!game.settings.get('twodsix', 'useCDWoundedStatusIndicators') || data === undefined) {
    return false;
  } else {
    switch (game.settings.get('twodsix', 'ruleset')) {
      case "CD":
      case "CEQ":
        return (data.characteristics?.lifeblood ? true : false);
      case "CEL":
      case "CEFTL":
      case "CE":
        return (data.characteristics?.endurance || data.characteristics?.strength || data.characteristics?.dexterity) ? true : false;
      default:
        return false;
    }
  }
}

async function applyWoundedEffect (selectedToken:Record<string, any>):Promise<void> {
  const damageColorTints = {
    minorWoundTint: '#FFFF00', // Yellow
    seriousWoundTint: '#FF0000', // Red
    deadTint: '#FFFFFF'  // White
  };

  let tintToApply = getIconTint(damageColorTints, selectedToken);

  const woundedEffectLabel = 'Bleeding';
  const deadEffectLabel = 'Dead';
  const unconsciousEffectLabel = 'Unconscious';

  if (!tintToApply) {
    await setEffectState(deadEffectLabel, selectedToken, false);
    await setEffectState(woundedEffectLabel, selectedToken, false);
  } else {
    if (tintToApply === damageColorTints.deadTint) {
      await setEffectState(deadEffectLabel, selectedToken, true);
      await setEffectState(woundedEffectLabel, selectedToken, false);
      await setEffectState(unconsciousEffectLabel, selectedToken, false);
    } else {
      await setEffectState(deadEffectLabel, selectedToken, false);
      const oldWoundState = await selectedToken.actor.data.effects.find(eff => eff.data.label === woundedEffectLabel);
      const isAlreadyUnconscious = await selectedToken.actor.data.effects.find(eff => eff.data.label === unconsciousEffectLabel);

      if (oldWoundState?.data.tint !== damageColorTints.seriousWoundTint && oldWoundState?.data.tint !== damageColorTints.deadTint && tintToApply === damageColorTints.seriousWoundTint && !isAlreadyUnconscious) {
        const returnRoll = await selectedToken.actor.characteristicRoll({ characteristic: 'END', difficulty: { mod: 0, target: 8 } }, false);
        if (returnRoll.effect < 0) {
          await setEffectState(unconsciousEffectLabel, selectedToken, true);
        }
      }

      await setEffectState(woundedEffectLabel, selectedToken, true);
      const newEffect = await selectedToken.actor.data.effects.find(eff => eff.data.label === woundedEffectLabel);
      await selectedToken.actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: newEffect.id, tint: tintToApply }]);
    }
  }
}

async function setEffectState (effectLabel: string, targetToken:Record<string, any>, state: boolean):Promise<void> {
  const isAlreadySet = await targetToken.actor.effects.find(eff => eff.data.label === effectLabel);
  if ((typeof isAlreadySet !== 'undefined') !== state) {
    const targetEffect = CONFIG.statusEffects.find(effect => (effect.id === effectLabel.toLowerCase()));
    await targetToken.toggleEffect(targetEffect);
  }
}

function getIconTint (tintMap: object, selectedToken: Record<string, any>):string {
  let returnVal = "";
  switch (game.settings.get('twodsix', 'ruleset')) {
    case "CD":
    case "CEQ":
      if (selectedToken.actor.data.data.characteristics.lifeblood.current < selectedToken.actor.data.data.characteristics.lifeblood.value) {
        returnVal = tintMap.minorWoundTint;
      }
      if (selectedToken.actor.data.data.characteristics.lifeblood.current < (selectedToken.actor.data.data.characteristics.lifeblood.value / 2)) {
        returnVal = tintMap.seriousWoundTint;
      }
      if (selectedToken.actor.data.data.characteristics.lifeblood.current === 0) {
        returnVal = tintMap.deadTint;
      }
      break;
    case "CEL":
    case "CEFTL":
    case "CE":
      if (selectedToken.actor.data.data.characteristics.strength.damage > 0 || selectedToken.actor.data.data.characteristics.dexterity.damage > 0 ||
        selectedToken.actor.data.data.characteristics.endurance.damage > 0 ) {
        returnVal = tintMap.minorWoundTint;
      }
      if ((selectedToken.actor.data.data.characteristics.strength.current === 0 && (selectedToken.actor.data.data.characteristics.dexterity.current === 0 ||
        selectedToken.actor.data.data.characteristics.endurance.current === 0)) || (selectedToken.actor.data.data.characteristics.dexterity.current === 0 &&
          selectedToken.actor.data.data.characteristics.endurance.current === 0) ) {
        returnVal = tintMap.seriousWoundTint;
      }
      if (selectedToken.actor.data.data.characteristics.strength.current === 0 && selectedToken.actor.data.data.characteristics.dexterity.current === 0 &&
        selectedToken.actor.data.data.characteristics.endurance.current === 0 ) {
        returnVal = tintMap.deadTint;
      }
      break;
    default:
      returnVal = "";
  }
  return returnVal;
}
