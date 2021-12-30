import {TwodsixSystem} from "../TwodsixSystem";

Hooks.once('setup', async function () {
  // Do anything after initialization but before ready

  window["Twodsix"] = new TwodsixSystem();
});
