import {TWODSIX} from "../config";
import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready

  CONFIG.TWODSIX = TWODSIX;

  window["Twodsix"] = new TwodsixSystem();
});
