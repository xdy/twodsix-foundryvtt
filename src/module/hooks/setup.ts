// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready
  CONFIG.statusEffects.push({id: 'encumbered', label: 'EFFECT.StatusEncumbered', icon: "systems/twodsix/assets/icons/weight.svg"});
  window["Twodsix"] = new TwodsixSystem();
});
