// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready

  //Configure TWODSIX custom conditions
  foundry.utils.mergeObject(CONFIG.statusEffects, {
    aiming: {id: 'aiming', name: 'EFFECT.StatusAiming', img: "systems/twodsix/assets/icons/aiming.svg"},
    cover: {id: 'cover', name: 'EFFECT.StatusInCover', img: "systems/twodsix/assets/icons/defensive-wall.svg"},
    fatigued: {id: 'fatigued', name: 'EFFECT.StatusFatigued', img: "systems/twodsix/assets/icons/tired-eye.svg"},
    encumbered: {id: 'encumbered', name: 'EFFECT.StatusEncumbered', img: "systems/twodsix/assets/icons/weight.svg"},
    irradiated: {id: 'irradiated', name: 'EFFECT.StatusIrradiated', img: "systems/twodsix/assets/icons/irradiated.svg"},
    thrust: {id: 'thrust', name: 'EFFECT.StatusThrust', img: "systems/twodsix/assets/icons/thrust.svg"},
    "target-lock": {id: 'target-lock', name: 'EFFECT.StatusTargetLock', img: "systems/twodsix/assets/icons/convergence-target.svg"},
    wounded: {id: 'wounded', name: 'EFFECT.StatusWounded', img: "systems/twodsix/assets/icons/blood.svg"},
    unconscious: {id: 'unconscious', name: 'EFFECT.StatusUnconscious', img: 'icons/svg/unconscious.svg', showIcon: ActiveEffect.SHOW_ICON_CHOICES.ALWAYS},
    dead: {id: 'dead', name: 'EFFECT.StatusDead', img: 'icons/svg/skull.svg', showIcon: ActiveEffect.SHOW_ICON_CHOICES.ALWAYS}
  });
  const bleeding = CONFIG.statusEffects.find(se => se.id === 'bleeding');
  if(bleeding) {
    delete CONFIG.statusEffects.bleeding;
  }

  window["Twodsix"] = new TwodsixSystem();
});
