// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready

  //Configure TWODSIX custom conditions
  CONFIG.statusEffects.push(
    {id: 'aiming', label: 'EFFECT.StatusAiming', icon: "systems/twodsix/assets/icons/aiming.svg"},
    {id: 'cover', label: 'EFFECT.StatusInCover', icon: "systems/twodsix/assets/icons/defensive-wall.svg"},
    {id: 'fatigued', label: 'EFFECT.StatusFatigued', icon: "systems/twodsix/assets/icons/tired-eye.svg"},
    {id: 'encumbered', label: 'EFFECT.StatusEncumbered', icon: "systems/twodsix/assets/icons/weight.svg"},
    {id: 'irradiated', label: 'EFFECT.StatusIrradiated', icon: "systems/twodsix/assets/icons/irradiated.svg"},
    {id: 'thrust', label: 'EFFECT.StatusThrust', icon: "systems/twodsix/assets/icons/thrust.svg"},
    {id: 'target-lock', label: 'EFFECT.StatusTargetLock', icon: "systems/twodsix/assets/icons/convergence-target.svg"}
  );
  const woundedSE = CONFIG.statusEffects.find(se => se.id === 'bleeding');
  if(woundedSE) {
    woundedSE.id = 'wounded';
    woundedSE.name = "EFFECT.StatusWounded";
  }

  window["Twodsix"] = new TwodsixSystem();
});
