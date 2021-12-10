/* eslint-disable semi */

if (game.settings.get('twodsix', 'showLifebloodStamina')) {
  applyWounds();
}

async function applyWounds () {
  for (let sceneToken of canvas.tokens.ownedTokens) {
    if (sceneToken.actor.type === 'traveller') {
      applyWoundedEffect(sceneToken);
    }
  }
}

async function applyWoundedEffect (selectedToken) {
  const minorWoundTint = '#FFFF00' // Yellow
  const seriousWoundTint = '#FF0000' // Red
  const deadTint = '#FFFFFF' // White

  let tintToApply;
  if (selectedToken.actor.data.data.characteristics.lifeblood.current < selectedToken.actor.data.data.characteristics.lifeblood.value) {
    tintToApply = minorWoundTint;
  }
  if (selectedToken.actor.data.data.characteristics.lifeblood.current < (selectedToken.actor.data.data.characteristics.lifeblood.value / 2)) {
    tintToApply = seriousWoundTint;
  }
  if (selectedToken.actor.data.data.characteristics.lifeblood.current === 0) {
    tintToApply = deadTint;
  }

  const woundedEffectLabel = 'Bleeding';
  const deadEffectLabel = 'Dead';
  const unconsciousEffectLabel = 'Unconscious';

  if (!tintToApply) {
    setEffectState(deadEffectLabel, selectedToken, false);
    setEffectState(woundedEffectLabel, selectedToken, false);
  } else {
    if (tintToApply === deadTint) {
      setEffectState(deadEffectLabel, selectedToken, true);
      setEffectState(woundedEffectLabel, selectedToken, false);
      setEffectState(unconsciousEffectLabel, selectedToken, false);
    } else {
      setEffectState(deadEffectLabel, selectedToken, false);
      const oldEffect = await selectedToken.actor.data.effects.find(eff => eff.data.label === woundedEffectLabel);

      if (oldEffect?.data.tint !== seriousWoundTint && tintToApply === seriousWoundTint) {
        const returnRoll = await selectedToken.actor.characteristicRoll({ characteristic: 'END', difficulty: { mod: 0, target: 8 } }, false);
        if (returnRoll.effect < 0) {
          setEffectState(unconsciousEffectLabel, selectedToken, true);
        }
      }

      await setEffectState(woundedEffectLabel, selectedToken, true);
      const newEffect = await selectedToken.actor.data.effects.find(eff => eff.data.label === woundedEffectLabel);
      await selectedToken.actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: newEffect.id, tint: tintToApply }]);
    }
  }
}

async function setEffectState (effectLabel, targetToken, state) {
  const isAlreadySet = targetToken.actor.effects.find(eff => eff.data.label === effectLabel);
  if ((typeof isAlreadySet !== 'undefined') !== state) {
    const targetEffect = CONFIG.statusEffects.find(effect => (effect.id === effectLabel.toLowerCase()));
    await targetToken.toggleEffect(targetEffect);
  }
}
