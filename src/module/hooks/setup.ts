// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready

  //Configure conditions
  CONFIG.statusEffects.push({id: 'encumbered', label: 'EFFECT.StatusEncumbered', icon: "systems/twodsix/assets/icons/weight.svg"});
  const woundedSE = CONFIG.statusEffects.find(se => se.id === 'bleeding');
  if(woundedSE) {
    woundedSE.id = 'wounded';
    woundedSE.name = "EFFECT.StatusWounded";
  }
  CONFIG.ActiveEffect.legacyTransferral = false;

  window["Twodsix"] = new TwodsixSystem();
});
