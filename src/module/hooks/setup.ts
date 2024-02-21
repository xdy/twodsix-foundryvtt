// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready

  //Configure TWODSIX custom conditions
  CONFIG.statusEffects.push(
    {id: 'aiming', name: 'EFFECT.StatusAiming', img: "systems/twodsix/assets/icons/aiming.svg"},
    {id: 'cover', name: 'EFFECT.StatusInCover', img: "systems/twodsix/assets/icons/defensive-wall.svg"},
    {id: 'fatigued', name: 'EFFECT.StatusFatigued', img: "systems/twodsix/assets/icons/tired-eye.svg"},
    {id: 'encumbered', name: 'EFFECT.StatusEncumbered', img: "systems/twodsix/assets/icons/weight.svg"},
    {id: 'irradiated', name: 'EFFECT.StatusIrradiated', img: "systems/twodsix/assets/icons/irradiated.svg"},
    {id: 'thrust', name: 'EFFECT.StatusThrust', img: "systems/twodsix/assets/icons/thrust.svg"},
    {id: 'target-lock', name: 'EFFECT.StatusTargetLock', img: "systems/twodsix/assets/icons/convergence-target.svg"}
  );
  const woundedSE = CONFIG.statusEffects.find(se => se.id === 'bleeding');
  if(woundedSE) {
    woundedSE.id = 'wounded';
    woundedSE.name = "EFFECT.StatusWounded";
  }

  window["Twodsix"] = new TwodsixSystem();
});
